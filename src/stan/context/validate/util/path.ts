/**
 * Small path normalization helpers for dependency selection validation; pure
 * string helpers; no filesystem IO.
 * @module
 */

/** Normalize Windows separators to POSIX separators. */
export const toPosix = (p: string): string => p.replace(/\\/g, '/');

/** Normalize a repo-ish path string for prefix comparisons. */
export const normalize = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

/** Return true when `rel` is equal to or under `prefix` (POSIX, normalized). */
export const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalize(prefix);
  const b = normalize(rel);
  return b === a || b.startsWith(`${a}/`);
};

export default { toPosix, normalize, isUnder };
