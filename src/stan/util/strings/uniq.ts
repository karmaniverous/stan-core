/**
 * Small string de-duplication helpers; used by selection planners and staging
 * flows to keep output deterministic.
 * @module
 */

/** Unique strings preserving first-seen order. */
export const uniqStrings = (xs: ReadonlyArray<string>): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
};

/** Unique strings sorted lexicographically (deterministic). */
export const uniqSortedStrings = (xs: ReadonlyArray<string>): string[] =>
  Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b));

export default { uniqStrings, uniqSortedStrings };
