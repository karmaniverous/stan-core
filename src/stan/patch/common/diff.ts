/* src/stan/patch/common/diff.ts
 * Unified diff helpers shared by detect/clean.
 */
import { ensureFinalLF, toLF } from '@/stan/text/eol';

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

export const isUnifiedDiff = (t: string): boolean => {
  if (/^diff --git /m.test(t)) return true;
  if (/^---\s+(?:a\/|\S)/m.test(t) && /^\+\+\+\s+(?:b\/|\S)/m.test(t))
    return true;
  if (/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(t)) return true;
  return false;
};

type FenceInfo = { ch: '`' | '~'; count: number };

/**
 * Parse a Markdown code fence opener line (backticks or tildes) at column 0.
 * We intentionally DO NOT accept indented fences here to avoid accidentally
 * treating diff context lines (which commonly start with a single space) as
 * nested fence delimiters.
 */
const parseFenceLine0 = (line: string): FenceInfo | null => {
  const m = line.match(/^([`~]{3,})/);
  if (!m || !m[1]) return null;
  const run = m[1];
  const ch = run[0] as '`' | '~';
  for (const c of run) if (c !== ch) return null;
  return { ch, count: run.length };
};

/** Return the first unified diff found (fenced or raw), else null. */
export const extractFirstUnifiedDiff = (text: string): string | null => {
  // First, try fenced blocks
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i];
    const fence = parseFenceLine0(open);
    if (!fence) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      // Do not trim leading whitespace: unified diffs commonly contain context
      // lines that start with a single space, which must not be mistaken for a
      // closing fence delimiter.
      const closeLine = lines[j].trimEnd();
      // Closing fence: exactly the same character/count (no language tag)
      if (closeLine === fence.ch.repeat(fence.count)) {
        const inner = lines.slice(i + 1, j).join('\n');
        if (isUnifiedDiff(inner)) return inner;
        i = j;
        break;
      }
    }
  }
  // Next, raw (git-style or minimal)
  let idx = text.search(/^diff --git /m);
  if (idx < 0) idx = text.search(/^---\s+(?:a\/|\S)/m);
  if (idx < 0) return null;
  const body = text.slice(idx);
  // If a trailing fence was present, strip it
  const trimmed = body.replace(/\n(?:`{3,}|~{3,})\s*$/m, '\n');
  return trimmed;
};

/** Normalize patch text to LF, strip zero-width, ensure trailing LF. */
export const normalizePatchText = (s: string): string => {
  const lf = toLF(s);
  const noZW = lf.replace(ZERO_WIDTH_RE, '');
  return ensureFinalLF(noZW);
};
