/**
 * Extracts repo-relative target paths from unified diffs; pure parsing; no
 * filesystem IO; used by patch pipeline diagnostics and tooling.
 *
 * Extract header-derived candidate paths from unified diff.
 * @module
 */
/**
 * Extract unique repo‑relative file paths from unified diff headers.
 *
 * @param cleaned - Unified diff text (already cleaned).
 * @returns An array of unique file paths referenced by `diff --git` headers.
 */
export const pathsFromPatch = (cleaned: string): string[] => {
  const out: string[] = [];
  const re = /^diff --git a\/(.+?) b\/\1/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const p = m[1].trim();
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
};
