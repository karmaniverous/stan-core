/**
 * Computes a deterministic size report for a context-mode allowlist (Base +
 * dependency closure). Uses dependency meta `metadata.size` (bytes) when
 * available and falls back to `stat()` for repo files; no file-body reads.
 * @module
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';

import { uniqSortedStrings } from '@/stan/util/array/uniq';

import type { DependencyMetaFile } from './schema';

const TOKEN_ESTIMATE_DIVISOR = 4;
const DEFAULT_TOP_N = 10;

const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

export type BudgetSource = 'meta' | 'stat' | 'missing';

export type BudgetEntry = {
  /** Repo-relative POSIX path. */
  path: string;
  /** Size in bytes (0 when unknown/missing). */
  bytes: number;
  /** Where the bytes estimate came from. */
  source: BudgetSource;
};

export type ContextAllowlistBudget = {
  /** Total number of allowlisted paths. */
  files: number;
  /** Total bytes across allowlisted paths. */
  totalBytes: number;
  /** Deterministic heuristic: totalBytes / 4. */
  estimatedTokens: number;
  /** Budgeting breakdown by set membership. */
  breakdown: {
    baseOnly: { files: number; bytes: number };
    closureOnly: { files: number; bytes: number };
    overlap: { files: number; bytes: number };
  };
  /** Largest allowlisted entries by byte size (descending). */
  largest: BudgetEntry[];
  /** Deterministic warnings (missing sizes, missing files, invalid metadata). */
  warnings: string[];
};

const safeMetaSize = (
  meta: Pick<DependencyMetaFile, 'nodes'>,
  rel: string,
): number | null => {
  const node = Object.prototype.hasOwnProperty.call(meta.nodes, rel)
    ? meta.nodes[rel]
    : undefined;
  if (!node) return null;

  const size = node.metadata?.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0)
    return null;
  return Math.floor(size);
};

const safeStatSize = async (
  cwd: string,
  rel: string,
): Promise<number | null> => {
  try {
    const abs = path.resolve(cwd, rel);
    const s = await stat(abs);
    if (!s.isFile()) return null;
    return s.size;
  } catch {
    return null;
  }
};

const cmpLargest = (a: BudgetEntry, b: BudgetEntry): number =>
  a.bytes === b.bytes ? a.path.localeCompare(b.path) : b.bytes - a.bytes;

const sumBytes = (entries: BudgetEntry[]): number =>
  entries.reduce((acc, e) => acc + e.bytes, 0);

/**
 * Summarize the byte size of a context allowlist deterministically.
 *
 * @param args - Inputs object (repo root, allowlist plan, dependency meta nodes
 * map, and optional max count for largest entries).
 */
export const summarizeContextAllowlistBudget = async (args: {
  cwd: string;
  plan: {
    baseFiles: ReadonlyArray<string>;
    selectedNodeIds: ReadonlyArray<string>;
    allowlistFiles: ReadonlyArray<string>;
  };
  meta: Pick<DependencyMetaFile, 'nodes'>;
  topN?: number;
}): Promise<ContextAllowlistBudget> => {
  const { cwd, plan, meta } = args;
  const topN =
    typeof args.topN === 'number' &&
    Number.isFinite(args.topN) &&
    args.topN >= 0
      ? Math.floor(args.topN)
      : DEFAULT_TOP_N;

  const baseSet = new Set<string>(uniqSortedStrings(plan.baseFiles, toPosix));
  const closureSet = new Set<string>(
    uniqSortedStrings(plan.selectedNodeIds, toPosix),
  );
  const allowlist = uniqSortedStrings(plan.allowlistFiles, toPosix);

  const warnings: string[] = [];

  const entries: BudgetEntry[] = [];
  for (const rel of allowlist) {
    const metaSize = safeMetaSize(meta, rel);
    if (typeof metaSize === 'number') {
      entries.push({ path: rel, bytes: metaSize, source: 'meta' });
      continue;
    }
    const stSize = await safeStatSize(cwd, rel);
    if (typeof stSize === 'number') {
      entries.push({ path: rel, bytes: stSize, source: 'stat' });
      continue;
    }
    warnings.push(`missing size for ${rel}`);
    entries.push({ path: rel, bytes: 0, source: 'missing' });
  }

  const totalBytes = sumBytes(entries);
  const estimatedTokens = totalBytes / TOKEN_ESTIMATE_DIVISOR;

  // Breakdown (base-only, closure-only, overlap) computed on the allowlist universe.
  const baseOnly: BudgetEntry[] = [];
  const closureOnly: BudgetEntry[] = [];
  const overlap: BudgetEntry[] = [];
  for (const e of entries) {
    const inBase = baseSet.has(e.path);
    const inClosure = closureSet.has(e.path);
    if (inBase && inClosure) overlap.push(e);
    else if (inBase) baseOnly.push(e);
    else if (inClosure) closureOnly.push(e);
    // else: allowlist member not in either set (should not happen, but tolerate)
  }

  const largest = [...entries].sort(cmpLargest).slice(0, topN);

  return {
    files: entries.length,
    totalBytes,
    estimatedTokens,
    breakdown: {
      baseOnly: { files: baseOnly.length, bytes: sumBytes(baseOnly) },
      closureOnly: { files: closureOnly.length, bytes: sumBytes(closureOnly) },
      overlap: { files: overlap.length, bytes: sumBytes(overlap) },
    },
    largest,
    warnings: uniqSortedStrings(warnings),
  };
};

export default { summarizeContextAllowlistBudget };
