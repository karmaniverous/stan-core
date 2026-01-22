/* src/stan/context/stage.ts
 * Stage external dependency bytes under <stanPath>/context/** prior to archiving.
 *
 * Requirements:
 * - Stage only dependency-staged external node IDs:
 *   - <stanPath>/context/npm/** and <stanPath>/context/abs/**
 * - Copy bytes from the current environment to the staged nodeId path.
 * - Verify sha256 (and size when present) matches meta.nodes[nodeId].metadata.
 * - Fail fast with a clear error message on mismatch/missing source.
 * - No console I/O; return structured results.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureDir, remove } from 'fs-extra';

import type { NodeSource } from './build';
import type { DependencyMetaFile } from './schema';

const toPosix = (p: string): string => p.replace(/\\/g, '/');

const normalizePrefix = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalizePrefix(prefix);
  const b = normalizePrefix(rel);
  return b === a || b.startsWith(`${a}/`);
};

const computeSha256Hex = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

const stageRootFor = (cwd: string, rel: string): string =>
  path.resolve(cwd, ...toPosix(rel).split('/'));

const isStageableNodeId = (stanPath: string, nodeId: string): boolean => {
  const base = normalizePrefix(stanPath);
  const rel = normalizePrefix(nodeId);
  return (
    isUnder(`${base}/context/npm`, rel) || isUnder(`${base}/context/abs`, rel)
  );
};

export type StageDependencyContextArgs = {
  cwd: string;
  stanPath: string;
  /** Parsed dependency meta (usually produced by buildDependencyMeta). */
  meta: Pick<DependencyMetaFile, 'nodes'>;
  /**
   * Optional source map (usually from buildDependencyMeta). If absent, abs
   * nodes can still be staged via meta.nodes[nodeId].locatorAbs.
   */
  sources?: Record<string, NodeSource>;
  /**
   * Optional subset of nodeIds to stage (e.g., a selection closure).
   * If omitted, stages all nodeIds present in sources (filtered to stageable).
   */
  nodeIds?: string[];
  /**
   * When true, clears <stanPath>/context/npm and <stanPath>/context/abs before staging.
   * Does NOT touch dependency.meta.json or dependency.state.json.
   */
  clean?: boolean;
};

export type StagedEntry = {
  nodeId: string;
  sourceAbs: string;
  destAbs: string;
  hash: string;
  size: number;
};

export type StageDependencyContextResult = {
  staged: StagedEntry[];
  skipped: string[];
};

const sourceAbsForNodeId = (
  nodeId: string,
  sources: Record<string, NodeSource> | undefined,
  metaNodes: Pick<DependencyMetaFile, 'nodes'>['nodes'],
): string | null => {
  const viaSources = sources ? sources[nodeId] : undefined;
  if (viaSources) {
    if (viaSources.kind === 'npm') return viaSources.sourceAbs;
    if (viaSources.kind === 'abs') return viaSources.sourceAbs;
    return null; // repo nodes are not staged
  }
  // Fallback for abs nodes: locatorAbs is stored in meta.
  const loc = metaNodes[nodeId]?.locatorAbs;
  return typeof loc === 'string' && loc.trim().length ? loc.trim() : null;
};

export const stageDependencyContext = async (
  args: StageDependencyContextArgs,
): Promise<StageDependencyContextResult> => {
  const { cwd, stanPath, meta, sources, nodeIds, clean = false } = args;

  const base = normalizePrefix(stanPath);

  if (clean) {
    const npmDir = stageRootFor(cwd, `${base}/context/npm`);
    const absDir = stageRootFor(cwd, `${base}/context/abs`);
    await remove(npmDir).catch(() => {});
    await remove(absDir).catch(() => {});
  }

  const candidates: string[] =
    Array.isArray(nodeIds) && nodeIds.length
      ? nodeIds.map(normalizePrefix)
      : Object.keys(sources ?? {}).map(normalizePrefix);

  const staged: StagedEntry[] = [];
  const skipped: string[] = [];

  for (const nodeId of candidates) {
    if (!isStageableNodeId(base, nodeId)) {
      skipped.push(nodeId);
      continue;
    }

    const node = meta.nodes[nodeId];
    const expectedHash = node?.metadata?.hash;
    const expectedSize = node?.metadata?.size;
    if (!node || !node.metadata || typeof expectedHash !== 'string') {
      throw new Error(
        `dependency context staging: missing metadata.hash for nodeId "${nodeId}"`,
      );
    }

    const sourceAbsRaw = sourceAbsForNodeId(nodeId, sources, meta.nodes);
    if (!sourceAbsRaw) {
      throw new Error(
        `dependency context staging: missing source locator for nodeId "${nodeId}"`,
      );
    }
    const sourceAbs = sourceAbsRaw;

    const buf = await readFile(sourceAbs);
    const size = buf.length;
    const hash = computeSha256Hex(buf);

    if (typeof expectedSize === 'number' && expectedSize !== size) {
      throw new Error(
        `dependency context staging: size mismatch for "${nodeId}" (expected ${expectedSize.toString()} bytes, got ${size.toString()} bytes)`,
      );
    }
    if (hash !== expectedHash) {
      throw new Error(
        `dependency context staging: hash mismatch for "${nodeId}" (expected ${expectedHash}, got ${hash})`,
      );
    }

    const destAbs = stageRootFor(cwd, nodeId);
    await ensureDir(path.dirname(destAbs));
    await writeFile(destAbs, buf);

    staged.push({ nodeId, sourceAbs: toPosix(sourceAbs), destAbs, hash, size });
  }

  return { staged, skipped };
};

export default { stageDependencyContext };
