/* src/stan/fs/match.ts
 * Engine-parity glob matcher helper for external callers (e.g., CLI plan previews).
 * - POSIX path normalization
 * - dot=true semantics
 * - Non-glob patterns treated as path prefixes
 */
import picomatch from 'picomatch';

const hasGlob = (p: string): boolean =>
  /[*?[\]{}()!]/.test(p) || p.includes('**');

const normalize = (p: string): string =>
  String(p)
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const matchesPrefix = (file: string, prefix: string): boolean => {
  const norm = normalize(prefix);
  return file === norm || file.startsWith(norm + '/');
};

const toMatcher = (pattern: string): ((f: string) => boolean) => {
  const pat = normalize(pattern);
  if (!hasGlob(pat)) {
    if (!pat) return () => false;
    return (f: string) => matchesPrefix(normalize(f), pat);
  }
  const isMatch = picomatch(pat, { dot: true });
  return (f: string) => isMatch(normalize(f));
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
  const mats = (patterns ?? []).map(toMatcher);
  if (mats.length === 0) return () => false;
  return (rel: string) => {
    const file = normalize(rel);
    for (const m of mats) if (m(file)) return true;
    return false;
  };
};

export default { makeGlobMatcher };
