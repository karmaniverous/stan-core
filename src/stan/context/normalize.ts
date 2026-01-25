/**
 * Normalizes dependency graph node IDs and metadata (POSIX, sha256, guards);
 * pure helpers; no filesystem IO; shared by context-mode modules.
 *
 * Small, reusable normalization helpers for dependency graph mode.
 *
 * Requirements:
 * - Deterministic normalization (POSIX paths, traversal guards).
 * - Keep modules small (\<300 LOC); used by build/stage/validate.
 * @module
 */
import { createHash } from 'node:crypto';
import path from 'node:path';

export const toPosix = (p: string): string => p.replace(/\\/g, '/');

export const ensureNoTraversal = (rel: string): boolean => {
  const parts = toPosix(rel).split('/').filter(Boolean);
  return !parts.some((s) => s === '..');
};

export const sha256Hex = (s: string): string =>
  createHash('sha256').update(s).digest('hex');

export const normalizeRepoLocal = (cwd: string, id: string): string | null => {
  const raw = toPosix(id).replace(/^\.\/+/, '');
  // If the graph returns an absolute path for a repo-local file, fold it to repo-relative.
  if (path.isAbsolute(id)) {
    const rel = toPosix(path.relative(cwd, id));
    if (!rel || rel.startsWith('..') || !ensureNoTraversal(rel)) return null;
    return rel;
  }
  if (!raw || raw.startsWith('..') || !ensureNoTraversal(raw)) return null;
  return raw;
};

export const normalizeAbsExternal = (
  stanPath: string,
  sourceAbs: string,
): { nodeId: string; locatorAbs: string; sourceAbsPosix: string } => {
  const sourceAbsPosix = toPosix(sourceAbs);
  const locatorAbs = sourceAbsPosix;
  const base = path.posix.basename(locatorAbs);
  const idHash = sha256Hex(locatorAbs);
  const nodeId = `${toPosix(stanPath)}/context/abs/${idHash}/${base}`;
  return { nodeId, locatorAbs, sourceAbsPosix };
};

export const sortRecordKeys = <T>(
  obj: Record<string, T>,
): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b)))
    out[k] = obj[k];
  return out;
};

export default {
  toPosix,
  ensureNoTraversal,
  sha256Hex,
  normalizeRepoLocal,
  normalizeAbsExternal,
  sortRecordKeys,
};
