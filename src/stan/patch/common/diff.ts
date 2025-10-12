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

/** Return the first unified diff found (fenced or raw), else null. */
export const extractFirstUnifiedDiff = (text: string): string | null => {
  // First, try fenced blocks
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i];
    const m = open.match(/^`{3,}.*$/);
    if (!m) continue;
    const tickCount = (open.match(/^`+/) ?? [''])[0].length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (new RegExp(`^\\\`${'{'}${tickCount}{'}'}\\s*$`).test(lines[j])) {
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
  const trimmed = body.replace(/\n`{3,}\s*$/m, '\n');
  return trimmed;
};

/** Normalize patch text to LF, strip zero-width, ensure trailing LF. */
export const normalizePatchText = (s: string): string => {
  const lf = toLF(s);
  const noZW = lf.replace(ZERO_WIDTH_RE, '');
  return ensureFinalLF(noZW);
};
