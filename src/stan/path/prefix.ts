/**
 * Normalized prefix comparisons for repo-relative POSIX paths; pure helpers.
 * @module
 */

import { toPosix } from './repo';

/** Normalize a repo-ish path string for stable prefix comparisons. */
export const normalizePrefix = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

/** Return true when `rel` is equal to or under `prefix` (POSIX, normalized). */
export const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalizePrefix(prefix);
  const b = normalizePrefix(rel);
  return b === a || b.startsWith(`${a}/`);
};

export default { normalizePrefix, isUnder };
