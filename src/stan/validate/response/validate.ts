/**
 * Core response logic: validates patch blocks, commit message, and File Ops.
 * @module
 */
import { extractFileOpsBody } from '@/stan/patch/common/file-ops';
import { normalizeRepoPath, toPosix } from '@/stan/path/repo';

import { extractBlocks, extractH2SectionBody } from './blocks';
import type { Block, ValidateResponseOptions, ValidationResult } from './types';

const parseDiffHeaders = (body: string): Array<{ a: string; b: string }> => {
  const re = /^diff --git a\/(.+?) b\/(.+?)\s*$/gm;
  const out: Array<{ a: string; b: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    out.push({ a: toPosix(m[1]), b: toPosix(m[2]) });
  }
  return out;
};

const patchHasAnyChangeLine = (body: string): boolean => {
  const lines = body.split(/\r?\n/);
  for (const l of lines) {
    if (
      l.startsWith('+++') ||
      l.startsWith('---') ||
      l.startsWith('diff --git') ||
      l.startsWith('@@')
    )
      continue;
    if (l.startsWith('+') || l.startsWith('-')) return true;
  }
  return false;
};

const validateFileOpsBlock = (text: string, errors: string[]): void => {
  const body = extractFileOpsBody(text);
  if (!body) return;
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const s = raw.trim();
    if (!s) continue;
    const parts = s.split(/\s+/);
    const verb = parts[0];
    const args = parts.slice(1);
    const where = `File Ops line ${(i + 1).toString()}`;
    const bad = (msg: string) => errors.push(`${where}: ${msg}`);
    const normSafe = (p?: string): string | null => normalizeRepoPath(p);

    if (!/^(mv|cp|rm|rmdir|mkdirp)$/.test(verb)) {
      bad(`unknown verb "${verb}"`);
      continue;
    }
    if (verb === 'mv' || verb === 'cp') {
      if (args.length !== 2) {
        bad(`expected 2 paths, got ${args.length.toString()}`);
        continue;
      }
      if (!normSafe(args[0]) || !normSafe(args[1]))
        bad(`${verb}: invalid repo-relative path`);
      continue;
    }
    if (args.length !== 1) {
      bad(`expected 1 path, got ${args.length.toString()}`);
      continue;
    }
    if (!normSafe(args[0])) bad(`${verb}: invalid repo-relative path`);
  }
};

export const validateResponseMessage = (
  text: string,
  options: ValidateResponseOptions = {},
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateFileOpsBlock(text, errors);

  const blocks = extractBlocks(text);
  const patches = blocks.filter((b) => b.kind === 'patch');
  const listings = blocks.filter((b) => b.kind === 'full');
  const commitBlocks = blocks.filter((b) => b.kind === 'commit');

  if (patches.length === 0) {
    errors.push('No Patch blocks found');
  }

  // 1) One Patch per file
  const seen = new Map<string, Block[]>();
  for (const p of patches) {
    const k = p.path ?? '(unknown)';
    const list = seen.get(k) ?? [];
    list.push(p);
    seen.set(k, list);
    const diffs = parseDiffHeaders(p.body);
    if (diffs.length === 0) {
      errors.push(
        `Patch for ${k} has no "diff --git a/<path> b/<path>" header; emit a plain unified diff with git-style headers`,
      );
    } else if (diffs.length !== 1) {
      errors.push(
        `Patch for ${k} contains multiple "diff --git" headers (found ${diffs.length.toString()}; expected 1)`,
      );
    }
    if (
      /(^|\n)\*{3,}\s*(Begin|End)\s+Patch\b|(^|\n)Index:\s|(^|\n)\*{3,}\s*Add\s+File:/i.test(
        p.body,
      )
    ) {
      errors.push(
        `Patch for ${k} contains a forbidden wrapper ("*** Begin Patch", etc). Use plain unified diff only.`,
      );
    }
    if (options.dependencyMode) {
      const sp = options.stanPath?.trim() || '.stan';
      const depState = `${toPosix(sp)}/context/dependency.state.json`;
      const targets = parseDiffHeaders(p.body).map((h) => toPosix(h.b));
      if (targets.includes(depState) && !patchHasAnyChangeLine(p.body)) {
        errors.push(
          `Patch for ${depState} appears to be a no-op (no + or - hunk lines)`,
        );
      }
    }
  }
  for (const [k, list] of seen.entries()) {
    if (list.length > 1)
      errors.push(
        `Multiple Patch blocks found for ${k} (${list.length.toString()})`,
      );
  }

  // 2) Patch precedes Full Listing
  const fullIndex = new Map<string, Block>();
  for (const f of listings)
    fullIndex.set(
      toPosix(typeof f.path === 'string' ? f.path : '(unknown)'),
      f,
    );
  for (const p of patches) {
    const key = toPosix(p.path as string);
    const f = fullIndex.get(key);
    if (f && !(p.start < f.start)) {
      errors.push(
        `Ordering violation for ${key}: Full Listing appears before Patch`,
      );
    }
  }

  // 3) Commit Message last
  if (commitBlocks.length === 0) {
    errors.push('Missing "## Commit Message" section');
  } else if (blocks.length > 0 && blocks[blocks.length - 1].kind !== 'commit') {
    errors.push('Commit Message is not last');
  }

  // 4) TODO patch requirement
  if (patches.length > 0) {
    const targets = patches.flatMap((p) => {
      const diffs = parseDiffHeaders(p.body);
      return diffs.length > 0
        ? diffs.map((d) => toPosix(d.b))
        : [toPosix(p.path ?? '')].filter(Boolean);
    });
    const isTodo = (s: string) => toPosix(s) === '.stan/system/stan.todo.md';
    const hasTodo = targets.some((t) => isTodo(t));
    if (!hasTodo) {
      // If any non-doc file is patched, warn
      const isDoc = (s: string) =>
        /^readme\.md$|^changelog\.md$|^license(\.md)?$|^contributing\.md$|^docs\/|^diagrams\//i.test(
          s.split('/').pop() ?? s,
        ) || s.startsWith('docs/');
      if (targets.some((t) => !isTodo(t) && !isDoc(t))) {
        errors.push(
          'Doc cadence violation: Patch present but no Patch for ".stan/system/stan.todo.md"',
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
};

export const validateOrThrow = (text: string): void => {
  const res = validateResponseMessage(text);
  if (!res.ok) {
    const msg =
      'Response-format validation failed:\n' +
      res.errors.map((e) => `- ${e}`).join('\n');
    throw new Error(msg);
  }
};
