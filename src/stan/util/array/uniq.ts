/**
 * Deduplicates and sorts string lists (trimmed; empty items removed); uses
 * Radash `unique` for de-duplication; pure helper; no filesystem IO.
 * @module
 */
import { unique } from 'radash';

/**
 * Normalize, de-duplicate, and sort strings deterministically.
 *
 * @param values - Input values (treated as strings; trimmed; empty items dropped).
 * @param normalize - Optional normalizer applied before trimming (e.g., POSIX path normalizer).
 * @returns Unique, lexicographically sorted string list.
 */
export const uniqSortedStrings = (
  values: ReadonlyArray<string>,
  normalize: (s: string) => string = (s) => s,
): string[] => {
  const normalized = values
    .map((v) => normalize(v).trim())
    .filter((v) => v.length > 0);
  return unique(normalized).sort((a, b) => a.localeCompare(b));
};

export default { uniqSortedStrings };
