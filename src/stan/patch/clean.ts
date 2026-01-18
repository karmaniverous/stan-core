import { ensureFinalLF } from '@/stan/text/eol';

import { extractFirstUnifiedDiff, normalizePatchText } from './common/diff';

const unwrapChatWrappers = (text: string): string => {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  let j = lines.length - 1;
  while (j >= 0 && lines[j].trim() === '') j -= 1;
  if (i > j) return text;

  const first = lines[i].trim();
  const last = lines[j].trim();

  const parseFence = (s: string): { ch: '`' | '~'; count: number } | null => {
    const m = s.match(/^([`~]{3,})/);
    if (!m || !m[1]) return null;
    const run = m[1];
    const ch = run[0] as '`' | '~';
    for (const c of run) if (c !== ch) return null;
    return { ch, count: run.length };
  };

  const isBegin = (s: string) => /^BEGIN[_ -]?PATCH/i.test(s);
  const isEnd = (s: string) => /^END[_ -]?PATCH/i.test(s);
  // Common non‑unified wrappers (e.g., "*** Begin Patch" / "*** End Patch")
  const isStarBegin = (s: string) =>
    /^\*{3,}\s*BEGIN\s+PATCH/i.test(s) || /^\*{3,}\s*Begin\s+Patch/i.test(s);
  const isStarEnd = (s: string) =>
    /^\*{3,}\s*END\s+PATCH/i.test(s) || /^\*{3,}\s*End\s+Patch/i.test(s);

  const unwrapIf = (cond: boolean): string => {
    if (!cond) return text;
    const inner = lines.slice(i + 1, j);
    return [...lines.slice(0, i), ...inner, ...lines.slice(j + 1)].join('\n');
  };

  const f1 = parseFence(first);
  const f2 = parseFence(last);
  if (f1 && f2 && f1.ch === f2.ch && f1.count === f2.count) {
    return unwrapIf(true);
  }
  if (isBegin(first) && isEnd(last)) return unwrapIf(true);
  if (isStarBegin(first) && isStarEnd(last)) return unwrapIf(true);
  return text;
};

/**
 * Detect and clean a patch payload from clipboard/file/argument.
 * - Unwraps chat fences and BEGIN/END PATCH banners when they wrap the entire payload.
 * - Extracts the first unified diff (fenced or raw).
 * - Normalizes EOL to LF, strips zero-width, and ensures a trailing newline.
 */
export const detectAndCleanPatch = (input: string): string => {
  const pre = normalizePatchText(input.trim());
  const maybeUnwrapped = unwrapChatWrappers(pre);
  const normalized = normalizePatchText(maybeUnwrapped);

  const first = extractFirstUnifiedDiff(normalized);
  if (first) return ensureFinalLF(normalizePatchText(first).trimEnd());

  return ensureFinalLF(normalized);
};
