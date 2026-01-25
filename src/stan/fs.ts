/**
 * Lists/filters repo files for archiving and snapshots (gitignore + includes/
 * excludes + reserved rules) and ensures STAN workspace dirs;
 * filesystem IO only.
 * @module
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ensureDir } from 'fs-extra';
import ignoreFactory from 'ignore';
import picomatch from 'picomatch';

import {
  isReservedWorkspacePath,
  isUnder as isUnderReserved,
} from './fs/reserved';
import { isUnder, normalizePrefix } from './path/prefix';
import type { StanDirs } from './paths';
import { functionGuard, resolveExport } from './util/ssr/resolve-export';

/**
 * Recursively enumerate files under `root`, returning POSIX-style
 * relative paths (`/` separators, no leading `./`). *
 * @param root - Absolute directory to walk.
 */
export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = ['.'];
  while (stack.length) {
    const rel = stack.pop() as string;
    const abs = resolve(root, rel);
    const entries = await readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel === '.' ? e.name : join(rel, e.name);
      if (e.isDirectory()) stack.push(childRel);
      else out.push(childRel.replace(/\\/g, '/'));
    }
  }
  return out;
}

/** Build an "ignore" instance from .gitignore (full pattern semantics). */
const buildIgnoreFromGitignore = async (
  cwd: string,
): Promise<ReturnType<typeof ignoreFactory> | null> => {
  const p = resolve(cwd, '.gitignore');
  if (!existsSync(p)) return null;
  try {
    const raw = await readFile(p, 'utf8');
    const ig = ignoreFactory();
    ig.add(raw);
    return ig;
  } catch {
    return null;
  }
};

const hasGlob = (p: string): boolean =>
  /[*?[\]{}()!]/.test(p) || p.includes('**');

type Matcher = (f: string) => boolean;

const toMatcher = (pattern: string): Matcher => {
  const pat = normalizePrefix(pattern);
  if (!hasGlob(pat)) {
    if (!pat) return () => false;
    return (f) => isUnder(pat, f);
  }
  const isMatch = picomatch(pat, { dot: true });
  return (f) => isMatch(f);
};

/**
 * Detect directories (at any depth) that contain their own package.json
 * (monorepo sub‑packages). Skips the repo root, node_modules/.git, and stanPath.
 */
const detectSubpackageDirs = (files: string[], stanRel: string): string[] => {
  const out = new Set<string>();
  for (const p of files) {
    if (p === 'package.json') continue; // repo root
    if (!p.endsWith('/package.json')) continue;
    const dir = p.slice(0, -'/package.json'.length);
    if (dir.startsWith('node_modules/') || dir.startsWith('.git/')) continue;
    if (dir === stanRel || dir.startsWith(`${stanRel}/`)) continue;
    if (dir.length > 0) out.add(dir);
  }
  return Array.from(out);
};

export type FilterOptions = {
  cwd: string;
  stanPath: string;
  includeOutputDir: boolean;
  includes?: string[];
  excludes?: string[];
};

/**
 * Filter a list of repo-relative paths according to:
 * - Base selection:
 *   - `.gitignore` semantics,
 *   - default denials (node_modules, .git),
 *   - user `excludes` (deny‑list globs),
 *   - STAN workspace rules (always exclude `stanPath/diff`; optionally exclude
 *     `stanPath/output` unless `includeOutputDir` is true).
 * - `includes` (allow‑list globs) — ADDITIVE augment with precedence:
 *   - When provided, matched files are ADDED to the base selection even if
 *     they would otherwise be excluded by `.gitignore` or default denials.
 *   - Config `excludes` take precedence over `includes` (i.e., explicit
 *     excludes always win).
 *   - Reserved exclusions still apply: `stanPath/diff` is always excluded;
 *     `stanPath/output` is excluded when `includeOutputDir` is false.
 *
 * Engine-owned `<stanPath>/**` behavior:
 * - Config `includes` and `excludes` are ignored for paths under `<stanPath>/**`.
 * - `.gitignore` is still honored under `<stanPath>/**` EXCEPT for:
 *   - `<stanPath>/system/**` (excluding `<stanPath>/system/.docs.meta.json`)
 *   - `<stanPath>/imports/**`
 *   These are treated as engine-owned and always included unless denied by
 *   reserved workspace rules.
 * Paths are compared using POSIX separators.
 * @param files - Repo‑relative paths to consider.
 * @param options - See {@link FilterOptions}.
 * @returns Filtered list to include in archives/snapshots.
 */
export async function filterFiles(
  files: string[],
  {
    cwd,
    stanPath,
    includeOutputDir,
    includes = [],
    excludes = [],
  }: FilterOptions,
): Promise<string[]> {
  const stanRel = stanPath.replace(/\\/g, '/');
  const isInStan = (f: string): boolean => isUnder(stanRel, f);
  const systemRel = `${stanRel}/system`;
  const importsRel = `${stanRel}/imports`;
  const docsMetaRel = `${systemRel}/.docs.meta.json`;

  const isEngineOwnedStanFile = (f: string): boolean => {
    // System docs and staged imports are engine-owned; they must remain
    // selectable regardless of `.gitignore` or config includes/excludes.
    if (isUnder(systemRel, f) && f !== docsMetaRel) return true;
    if (isUnder(importsRel, f)) return true;
    return false;
  };

  // Default sub‑package exclusion: any directory that contains its own package.json
  const subpkgDirs = detectSubpackageDirs(files, stanRel);

  const ig = await buildIgnoreFromGitignore(cwd);

  const excludeMatchers = excludes.map(toMatcher);
  const subpkgMatchers: Matcher[] = subpkgDirs.map(
    (d) => (f: string) => isUnder(d, f),
  );

  const isConfigExcluded = (f: string): boolean => {
    // Config excludes are hard denials outside stanPath; ignored under stanPath.
    if (isInStan(f)) return false;
    return excludeMatchers.some((m) => m(f));
  };
  const isConfigIncluded = (f: string, allowMatchers: Matcher[]): boolean => {
    // Config includes are additive outside stanPath; ignored under stanPath.
    if (isInStan(f)) return false;
    return allowMatchers.some((m) => m(f));
  };

  // Base selection (deterministic; engine-owned STAN exceptions applied).
  const base = files.filter((f) => {
    // default denials by prefix
    if (isUnder('node_modules', f)) return false;
    if (isUnder('.git', f)) return false;

    // Reserved workspace paths are always excluded by policy.
    if (isReservedWorkspacePath(stanRel, f)) return false;

    // Output dir is excluded by default unless explicitly included by mode.
    if (!includeOutputDir && isUnderReserved(`${stanRel}/output`, f))
      return false;

    // Engine-owned STAN docs/imports are always included (unless denied above).
    if (isEngineOwnedStanFile(f)) return true;

    // gitignore applies normally elsewhere (including most of <stanPath>/**).
    if (ig && ig.ignores(f)) return false;

    // Config excludes apply outside <stanPath>/**
    if (isConfigExcluded(f)) return false;

    // default: exclude nested sub‑packages by prefix
    if (subpkgMatchers.some((m) => m(f))) return false;

    return true;
  });

  // Additive includes: union with base, but excludes and reserved denials still win.
  if (includes.length > 0) {
    const allowMatchers: Matcher[] = includes.map(toMatcher);
    // Build union: start from base, add includes (even if gitignored/default-denied)
    const inUnion = new Set<string>(base);
    for (const f of files) {
      if (isConfigIncluded(f, allowMatchers)) inUnion.add(f);
    }

    const blocked: Matcher[] = [
      // .git is always excluded (never include, even via includes)
      (f: string) => isUnder('.git', f),
      // Still reserve-exclude patch/diff even if explicitly included.
      (f: string) => isReservedWorkspacePath(stanRel, f),
      ...(includeOutputDir
        ? []
        : [(f: string) => isUnderReserved(`${stanRel}/output`, f)]),
      // Excludes take precedence over includes.
      ...excludeMatchers.map((m) => (f: string) => !isInStan(f) && m(f)),
    ];

    const final = new Set<string>(
      files.filter((f) => inUnion.has(f) && !blocked.some((m) => m(f))),
    );
    return files.filter((f) => final.has(f));
  }

  return base;
}
/**
 * Ensure `<stanPath>` workspace exists (root/output/diff/patch).
 * Returns the resolved directory set.
 */
export async function ensureStanWorkspace(
  cwd: string,
  stanPath: string,
): Promise<{
  rootAbs: string;
  outputAbs: string;
  diffAbs: string;
  patchAbs: string;
}> {
  type MakeStanDirs = (cwd: string, stanPath: string) => StanDirs;
  const mk = await resolveExport(
    () => import('./paths'),
    'makeStanDirs',
    functionGuard<MakeStanDirs>(),
    { moduleLabel: './paths', acceptCallableDefault: true },
  );
  const dirs = mk(cwd, stanPath);
  await ensureDir(dirs.rootAbs);
  await ensureDir(dirs.outputAbs);
  await ensureDir(dirs.diffAbs);
  // Ensure patch workspace exists (archives exclude it by policy)
  await ensureDir(dirs.patchAbs);
  return {
    rootAbs: dirs.rootAbs,
    outputAbs: dirs.outputAbs,
    diffAbs: dirs.diffAbs,
    patchAbs: dirs.patchAbs,
  };
}

/** Back-compat: ensureOutAndDiff returns just output/diff absolute paths. */
export async function ensureOutAndDiff(
  cwd: string,
  stanPath: string,
): Promise<{ outDir: string; diffDir: string }> {
  const w = await ensureStanWorkspace(cwd, stanPath);
  return { outDir: w.outputAbs, diffDir: w.diffAbs };
}
