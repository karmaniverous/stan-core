/**
 * Normalizes npm external node IDs to staged <stanPath>/context/npm/** paths;
 * reads package.json; filesystem IO only; no console output.
 *
 * npm external normalization:
 * - For an external file, find nearest package.json and derive:
 *   <stanPath>/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>
 * @module
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureNoTraversal, toPosix } from './normalize';

const tryReadJson = async (
  abs: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const raw = await readFile(abs, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const findNearestPackageRoot = async (
  fileAbs: string,
): Promise<string | null> => {
  // Walk upward until we find a package.json. Stop at filesystem root.
  let cursor = path.dirname(fileAbs);
  for (let i = 0; i < 64; i += 1) {
    const p = path.join(cursor, 'package.json');
    const obj = await tryReadJson(p);
    if (
      obj &&
      typeof obj.name === 'string' &&
      typeof obj.version === 'string'
    ) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return null;
};

export const normalizeNpmExternal = async (
  stanPath: string,
  sourceAbs: string,
): Promise<{
  nodeId: string;
  pkgName: string;
  pkgVersion: string;
  pathInPackage: string;
  sourceAbsPosix: string;
} | null> => {
  const pkgRoot = await findNearestPackageRoot(sourceAbs);
  if (!pkgRoot) return null;
  const pkgJson = await tryReadJson(path.join(pkgRoot, 'package.json'));
  const pkgName = typeof pkgJson?.name === 'string' ? pkgJson.name : null;
  const pkgVersion =
    typeof pkgJson?.version === 'string' ? pkgJson.version : null;
  if (!pkgName || !pkgVersion) return null;

  const relInPkg = toPosix(path.relative(pkgRoot, sourceAbs));
  if (!relInPkg || relInPkg.startsWith('..') || !ensureNoTraversal(relInPkg)) {
    return null;
  }

  const nodeId = `${toPosix(stanPath)}/context/npm/${toPosix(pkgName)}/${toPosix(pkgVersion)}/${relInPkg}`;
  if (!ensureNoTraversal(nodeId)) return null;

  return {
    nodeId,
    pkgName,
    pkgVersion,
    pathInPackage: relInPkg,
    sourceAbsPosix: toPosix(sourceAbs),
  };
};

export default { normalizeNpmExternal };
