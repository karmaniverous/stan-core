/**
 * Stages external dependency bytes into <stanPath>/context/\{npm,abs\}/** and
 * verifies sha256/size; filesystem IO only; no console output.
 * verifies against dependency.map.json (V1).
 * @module
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureDir, remove } from 'fs-extra';

import { isUnder, normalizePrefix } from '@/stan/path/prefix';
import { toPosix } from '@/stan/path/repo';

import type { DependencyMapFile } from './schema';

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
  /** Host-private dependency map (canonical node -> locator/hash). */
  map: DependencyMapFile;

  /**
   * Optional subset of nodeIds to stage (e.g., a selection closure).
   * If omitted, stages all nodeIds present in map (filtered to stageable).
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

export const stageDependencyContext = async (
  args: StageDependencyContextArgs,
): Promise<StageDependencyContextResult> => {
  const { cwd, stanPath, map, nodeIds, clean = false } = args;

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
      : Object.keys(map.nodes).map(normalizePrefix);

  const staged: StagedEntry[] = [];
  const skipped: string[] = [];

  for (const nodeId of candidates) {
    if (!isStageableNodeId(base, nodeId)) {
      skipped.push(nodeId);
      continue;
    }

    const entry = map.nodes[nodeId];
    if (!entry) {
      throw new Error(
        `dependency context staging: missing map entry for nodeId "${nodeId}"`,
      );
    }

    const { locatorAbs, size: expectedSize, sha256: expectedHash } = entry;

    let buf: Buffer;
    try {
      buf = await readFile(locatorAbs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `dependency context staging: failed to read locator "${locatorAbs}": ${msg}`,
      );
    }

    const size = buf.length;
    const hash = computeSha256Hex(buf);

    if (expectedSize !== size) {
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

    staged.push({
      nodeId,
      sourceAbs: toPosix(locatorAbs),
      destAbs,
      hash,
      size,
    });
  }

  return { staged, skipped };
};

export default { stageDependencyContext };
