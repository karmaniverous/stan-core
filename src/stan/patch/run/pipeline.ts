/* src/stan/patch/run/pipeline.ts
 * Worktree-first patch application pipeline: git apply attempts across p1→p0, then jsdiff fallback.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ApplyResult } from '../apply';
import { buildApplyAttempts, runGitApply } from '../apply';
import type { JsDiffOutcome } from '../jsdiff';
import { applyWithJsDiff } from '../jsdiff';

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
    ? path.join(cwd, '.stan', 'patch', '.sandbox', 'F')
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
}): Promise<PipelineOutcome> => {
  const { cwd, patchAbs, cleaned, check, stripOrder = [1, 0] } = args;

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
  });

  if (js.okFiles.length > 0 && js.failed.length === 0) {
    return { ok: true, result, js };
  }

  // Last-resort: creation fallback for malformed but clearly new-file diffs
  try {
    const created = await tryCreationFallback(cwd, cleaned, check);
    if (created) return { ok: true, result, js: created };
  } catch {
    // best-effort; fall through to not-ok
  }
  return { ok: false, result, js };
};
