/**
 * Creates diff archives and manages snapshot state; computes sha256 file hashes;
 * writes snapshot/sentinel files; performs filesystem IO; no console output.
 * @module
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { SelectionReport } from './archive/report';
import { surfaceSelectionReport } from './archive/report';
import {
  composeFilesWithOutput,
  makeTarFilter,
  surfaceArchiveWarnings,
} from './archive/util';
import { ensureOutAndDiff, filterFiles, listFiles } from './fs';
type TarLike = {
  create: (
    opts: {
      file: string;
      cwd?: string;
      filter?: (path: string, stat: unknown) => boolean;
    },
    files: string[],
  ) => Promise<void>;
};
export type SnapshotUpdateMode = 'never' | 'createIfMissing' | 'replace';

const computeCurrentHashes = async (
  cwd: string,
  relFiles: string[],
): Promise<Record<string, string>> => {
  const current: Record<string, string> = {};
  for (const rel of relFiles) {
    const abs = resolve(cwd, rel);
    const buf = await readFile(abs);
    const h = createHash('sha256').update(buf).digest('hex');
    current[rel] = h;
  }
  return current;
};

const snapshotPathFor = (diffDir: string): string =>
  join(diffDir, '.archive.snapshot.json');

const sentinelPathFor = (diffDir: string): string =>
  join(diffDir, '.stan_no_changes');

/**
 * SSR‑safe resolver for classifyForArchive (named‑or‑default).
 * Prefer the named export; fall back to default.classifyForArchive.
 */
const getClassifyForArchive = async (): Promise<
  (typeof import('./classifier'))['classifyForArchive']
> => {
  try {
    const mod = await import('./classifier');
    const named = (mod as { classifyForArchive?: unknown }).classifyForArchive;
    const viaDefault = (mod as { default?: { classifyForArchive?: unknown } })
      .default?.classifyForArchive;
    const fn = (typeof named === 'function' ? named : viaDefault) as
      | (typeof import('./classifier'))['classifyForArchive']
      | undefined;
    if (typeof fn === 'function') return fn;
  } catch {
    /* ignore */
  }
  throw new Error('classifyForArchive export not found in ./classifier');
};
/**
 * Compute (and optionally update) the snapshot file in <stanPath>/diff/.
 * Returns the absolute snapshot path.
 *
 * @param args - Object with:
 *   - cwd: Repo root.
 *   - stanPath: STAN workspace folder.
 *   - includes: Allow‑list globs (overrides excludes).
 *   - excludes: Deny‑list globs.
 *
 * @example
 * ```ts
 * // Seed snapshot using includes to bring back gitignored files:
 * await writeArchiveSnapshot({
 *   cwd: process.cwd(),
 *   stanPath: '.stan',
 *   includes: ['README.md'],
 * });
 * ```
 * @returns Absolute path to the `.archive.snapshot.json` file.
 */
export async function writeArchiveSnapshot({
  cwd,
  stanPath,
  includes,
  excludes,
}: {
  cwd: string;
  stanPath: string;
  includes?: string[];
  excludes?: string[];
}): Promise<string> {
  const { diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  const current = await computeCurrentHashes(cwd, filtered);
  const snapPath = snapshotPathFor(diffDir);
  await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  return snapPath;
}

/**
 * Create a diff tar at <stanPath>/output/<baseName>.diff.tar.
 * - If snapshot exists: include only changed files.
 * - If no snapshot exists: include full file list (diff equals full archive).
 * - Snapshot update behavior is controlled by updateSnapshot.
 * - When includeOutputDirInDiff === true, also include the entire <stanPath>/output tree
 *   (excluding <stanPath>/diff and the two archive files) regardless of change list length.
 *
 * @param args - Object with:
 *   - cwd: Repo root.
 *   - stanPath: STAN workspace folder.
 *   - baseName: Base archive name (e.g., `archive` -\> `archive.diff.tar`).
 *   - includes: Allow‑list globs (overrides excludes).
 *   - excludes: Deny‑list globs.
 *   - updateSnapshot: Controls when the snapshot file is replaced.
 *   - includeOutputDirInDiff: When true, include `stanPath/output` in the diff.
 * @returns `{ diffPath }` absolute path to the diff archive.
 *
 * @example
 * ```ts
 * // Diff archive with includes to bring back gitignored files:
 * const { diffPath } = await createArchiveDiff({
 *   cwd: process.cwd(),
 *   stanPath: '.stan',
 *   baseName: 'archive',
 *   includes: ['docs/overview.md'],
 *   updateSnapshot: 'createIfMissing',
 * });
 * ```
 */
export async function createArchiveDiff({
  cwd,
  stanPath,
  baseName,
  includes,
  excludes,
  updateSnapshot = 'createIfMissing',
  includeOutputDirInDiff = false,
  onArchiveWarnings,
  onSelectionReport,
}: {
  cwd: string;
  stanPath: string;
  baseName: string;
  includes?: string[];
  excludes?: string[];
  updateSnapshot?: SnapshotUpdateMode;
  includeOutputDirInDiff?: boolean;
  onArchiveWarnings?: (text: string) => void;
  onSelectionReport?: (report: SelectionReport) => void;
}): Promise<{ diffPath: string }> {
  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: includes ?? [],
    excludes: excludes ?? [],
  });

  const current = await computeCurrentHashes(cwd, filtered);

  const snapPath = snapshotPathFor(diffDir);
  const hasPrev = existsSync(snapPath);
  const prev: Record<string, string> = hasPrev
    ? (JSON.parse(await readFile(snapPath, 'utf8')) as Record<string, string>)
    : {};

  const changedRaw: string[] = hasPrev
    ? filtered.filter((rel) => !prev[rel] || prev[rel] !== current[rel])
    : [...filtered];

  // Classify like the regular archive:
  // - exclude binaries
  // - flag large text (not excluded)
  const classifyForArchive = await getClassifyForArchive();
  const { textFiles, excludedBinaries, largeText, warningsBody } =
    await classifyForArchive(cwd, changedRaw);
  const changed = textFiles;

  surfaceArchiveWarnings(warningsBody, onArchiveWarnings);

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;

  const sentinelUsed = !includeOutputDirInDiff && changed.length === 0;
  surfaceSelectionReport(
    {
      kind: 'diff',
      mode: 'denylist',
      stanPath,
      outputFile: diffPath,
      includeOutputDirInDiff,
      updateSnapshot,
      snapshotExists: hasPrev,
      baseSelected: filtered.length,
      sentinelUsed,
      hasWarnings: excludedBinaries.length > 0 || largeText.length > 0,
      counts: {
        candidates: filtered.length,
        selected: changedRaw.length,
        archived: changed.length,
        excludedBinaries: excludedBinaries.length,
        largeText: largeText.length,
      },
    },
    onSelectionReport,
  );

  if (includeOutputDirInDiff) {
    await tar.create(
      {
        file: diffPath,
        cwd,
        filter: makeTarFilter(stanPath),
      },
      composeFilesWithOutput(changed, stanPath),
    );
  } else if (changed.length === 0) {
    const sentinel = sentinelPathFor(diffDir);
    await writeFile(sentinel, 'no changes', 'utf8');
    const files = [`${stanPath.replace(/\\/g, '/')}/diff/.stan_no_changes`];
    await tar.create({ file: diffPath, cwd }, files);
  } else {
    const files = Array.from(new Set([...changed]));
    await tar.create({ file: diffPath, cwd }, files);
  }

  if (updateSnapshot === 'replace') {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  } else if (updateSnapshot === 'createIfMissing' && !hasPrev) {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  }

  return { diffPath };
}
