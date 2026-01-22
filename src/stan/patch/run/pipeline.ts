/**
 * Applies unified diffs via git-apply cascade then jsdiff fallback; blocks
 * writes to protected `<stanPath>/imports/**`; may write sandbox outputs and
 * touches filesystem; no console output.
 * @module
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ApplyResult } from '../apply';
import { buildApplyAttempts, runGitApply } from '../apply';
import type { JsDiffOutcome } from '../jsdiff';
import { applyWithJsDiff } from '../jsdiff';
import { listProtectedImportsViolations } from '../policy/imports';

const touchedPathsFromUnifiedDiff = (cleaned: string): string[] => {
  const out: string[] = [];
  // Primary: git-style diff header
  {
    const re = /^diff --git a\/(.+?) b\/(.+?)\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned))) {
      const b = m[2].trim();
      if (!b || b === '/dev/null') continue;
      out.push(b.replace(/^\.\/+/, '').replace(/\\/g, '/'));
    }
  }
  // Fallback: +++ header (for minimal diffs)
  if (out.length === 0) {
    const re = /^\+\+\+\s+(?:b\/)?(.+?)\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned))) {
      const p = m[1].trim();
      if (!p || p === '/dev/null') continue;
      out.push(p.replace(/^\.\/+/, '').replace(/\\/g, '/'));
    }
  }
  return Array.from(new Set(out));
};

/**
 * Try a last-resort creation fallback for a confident "/dev/null -\> b/<path>" patch:
 * - Detect exactly one creation target.
 * - Extract hunk body lines; keep "+" and " " (drop "-" lines).
 * - Write to repo (check=false) or sandbox (check=true).
 * Returns a JsDiffOutcome-shaped result on success, or null when not applicable.
 */
const tryCreationFallback = async (
  cwd: string,
  cleaned: string,
  check: boolean,
  stanPath: string,
): Promise<JsDiffOutcome | null> => {
  const text = cleaned.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  // Locate a single "/dev/null" old header followed by "+++ b/<path>"
  let plusIdx = -1;
  let newRel: string | null = null;
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/^---\s+\/dev\/null\s*$/.test(lines[i])) {
      const m = lines[i + 1].match(/^\+\+\+\s+b\/(.+)\s*$/);
      if (m && m[1]) {
        plusIdx = i + 1;
        newRel = m[1].trim().replace(/^\.\//, '').replace(/\\/g, '/');
        break;
      }
    }
  }
  if (!newRel || !newRel.length) return null;
  // Abort if a second creation pair exists (multi-file fallback not supported)
  const tail = lines.slice(plusIdx + 1).join('\n');
  if (/^---\s+\/dev\/null/m.test(tail)) return null;

  // Collect hunk body additions/context
  const bodyLines: string[] = [];
  let inHunk = false;
  for (let i = plusIdx + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^diff --git /.test(l)) break;
    if (/^@@ /.test(l)) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (/^[ +-]/.test(l)) {
      const marker = l[0] as ' ' | '+' | '-';
      if (marker === '+' || marker === ' ') {
        bodyLines.push(l.slice(1));
      }
      // deletions are ignored for a creation
    }
  }
  let content = bodyLines.join('\n');
  if (!content.endsWith('\n')) content += '\n';

  const destRoot = check
    ? path.join(cwd, stanPath, 'patch', '.sandbox', 'F')
    : cwd;
  const abs = path.resolve(destRoot, newRel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf8');
  return {
    okFiles: [newRel],
    failed: [],
    sandboxRoot: check ? destRoot : undefined,
  };
};

export type PipelineOutcome = {
  ok: boolean;
  result: ApplyResult;
  js: JsDiffOutcome | null;
};

/** Apply a cleaned unified diff to the working tree (no staging). */
export const applyPatchPipeline = async (args: {
  cwd: string;
  patchAbs: string;
  cleaned: string;
  check: boolean;
  /** Attempt order; defaults to [1,0] (p1 then p0). */
  stripOrder?: number[];
  /** When provided, enables protection rules scoped to this workspace (e.g., imports read-only). */
  stanPath?: string;
}): Promise<PipelineOutcome> => {
  const {
    cwd,
    patchAbs,
    cleaned,
    check,
    stripOrder = [1, 0],
    stanPath = '.stan',
  } = args;

  // Policy guard: never modify staged imports
  const touched = touchedPathsFromUnifiedDiff(cleaned);
  const violations = listProtectedImportsViolations(stanPath, touched);
  if (violations.length > 0) {
    const js: JsDiffOutcome = {
      okFiles: [],
      failed: violations.map((p) => ({
        path: p,
        reason: 'refusing to modify protected imports path',
      })),
      sandboxRoot: undefined,
    };
    return {
      ok: false,
      result: { ok: false, tried: [], lastCode: 1, captures: [] },
      js,
    };
  }

  // Git attempts (worktree only; never --index)
  const attempts = stripOrder.flatMap((p) =>
    buildApplyAttempts(check, p, false),
  );
  const result = await runGitApply(cwd, patchAbs, attempts);
  if (result.ok) {
    return { ok: true, result, js: null };
  }

  // jsdiff fallback (unstaged; sandbox when --check)
  const js = await applyWithJsDiff({
    cwd,
    cleaned,
    check,
    stanPath,
  });

  if (js.okFiles.length > 0 && js.failed.length === 0) {
    return { ok: true, result, js };
  }

  // Last-resort: creation fallback for malformed but clearly new-file diffs
  try {
    const created = await tryCreationFallback(cwd, cleaned, check, stanPath);
    if (created) return { ok: true, result, js: created };
  } catch {
    // best-effort; fall through to not-ok
  }
  return { ok: false, result, js };
};
