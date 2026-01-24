/**
 * Compiles engine-parity glob/prefix matchers; pure helper; no filesystem IO;
 * used by callers (e.g., CLI plan previews).
 *
 * - POSIX path normalization
 * - dot=true semantics
 * - Non-glob patterns treated as path prefixes
 * @module
 */
import picomatch from 'picomatch';

import { isUnder, normalizePrefix } from '@/stan/path/prefix';

const hasGlob = (p: string): boolean =>
  /[*?[\]{}()!]/.test(p) || p.includes('**');

const toMatcher = (pattern: string): ((f: string) => boolean) => {
  const pat = normalizePrefix(pattern);
  if (!hasGlob(pat)) {
    if (!pat) return () => false;
    // isUnder(prefix, file)
    return (f: string) => isUnder(pat, f);
  }
  const isMatch = picomatch(pat, { dot: true });
  return (f: string) => isMatch(normalizePrefix(f));
};

/**
 * Compile an engine‑parity matcher that returns true when any pattern matches.
 *
 * @param patterns - Glob/prefix patterns (POSIX paths).
 * @returns (relPath) =\> boolean
 */
export const makeGlobMatcher = (
  patterns: string[],
): ((rel: string) => boolean) => {
  const mats = patterns.map(toMatcher);
  if (mats.length === 0) return () => false;
  return (rel: string) => {
    const file = normalize(rel);
    for (const m of mats) if (m(file)) return true;
    return false;
  };
};

export default { makeGlobMatcher };
