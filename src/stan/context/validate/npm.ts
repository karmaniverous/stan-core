/**
 * Validates npm-staged dependency nodes for undo/redo by locating the
 * installed package@version and hashing pathInPackage; filesystem IO only; no
 * console output.
 * @module
 */

import path from 'node:path';

import fg from 'fast-glob';

import type { DependencyMetaNode } from '../schema';
import type { DependencyValidationMismatch } from './types';
import { sha256FileAbs } from './util/hash';
import { normalize, toPosix } from './util/path';

type NpmRef = { pkgName: string; pkgVersion: string; pathInPackage: string };

const expectedHashFor = (
  node: DependencyMetaNode | undefined,
): string | null =>
  typeof node?.metadata?.hash === 'string' && node.metadata.hash.length
    ? node.metadata.hash
    : null;

const expectedSizeFor = (
  node: DependencyMetaNode | undefined,
): number | null =>
  typeof node?.metadata?.size === 'number' &&
  Number.isFinite(node.metadata.size)
    ? node.metadata.size
    : null;

export const parseNpmNodeId = (
  stanPath: string,
  nodeId: string,
): NpmRef | null => {
  const base = normalize(stanPath);
  const rel = normalize(nodeId);
  const prefix = `${base}/context/npm/`;
  if (!rel.startsWith(prefix)) return null;

  const rest = rel.slice(prefix.length);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length < 3) return null;

  if (parts[0]?.startsWith('@')) {
    if (parts.length < 4) return null;
    const pkgName = `${parts[0]}/${parts[1]}`;
    const pkgVersion = parts[2];
    const pathInPackage = parts.slice(3).join('/');
    if (!pkgName || !pkgVersion || !pathInPackage) return null;
    return { pkgName, pkgVersion, pathInPackage };
  }

  const pkgName = parts[0];
  const pkgVersion = parts[1];
  const pathInPackage = parts.slice(2).join('/');
  if (!pkgName || !pkgVersion || !pathInPackage) return null;
  return { pkgName, pkgVersion, pathInPackage };
};

const readJson = async (
  abs: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(abs, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const findPackageRoots = async (
  cwd: string,
  pkgName: string,
): Promise<string[]> => {
  const out: string[] = [];

  // Direct node_modules/<pkgName>
  {
    const pkgJsonAbs = path.join(
      cwd,
      'node_modules',
      ...pkgName.split('/'),
      'package.json',
    );
    const obj = await readJson(pkgJsonAbs);
    if (obj) out.push(path.dirname(pkgJsonAbs));
  }

  // pnpm layout: node_modules/.pnpm/**/node_modules/<pkgName>/package.json
  try {
    const pnpmRoot = path.join(cwd, 'node_modules', '.pnpm');
    const pattern = toPosix(
      path.join(
        pnpmRoot,
        '**',
        'node_modules',
        ...pkgName.split('/'),
        'package.json',
      ),
    );
    const matches = await fg(pattern, {
      cwd,
      absolute: true,
      dot: true,
      onlyFiles: true,
      followSymbolicLinks: false,
    });
    for (const p of matches) out.push(path.dirname(p));
  } catch {
    // best-effort: pnpm layout not present
  }

  return Array.from(new Set(out.map((p) => toPosix(p)))).sort((a, b) =>
    a.localeCompare(b),
  );
};

export const validateNpmNode = async (args: {
  cwd: string;
  stanPath: string;
  nodeId: string;
  node: DependencyMetaNode | undefined;
}): Promise<DependencyValidationMismatch | null> => {
  const { cwd, stanPath, nodeId, node } = args;
  const parsed = parseNpmNodeId(stanPath, nodeId);
  if (!parsed) return { nodeId, kind: 'npm', reason: 'invalid-nodeId' };

  if (!node) return { nodeId, kind: 'npm', reason: 'meta-missing', ...parsed };

  const expectedHash = expectedHashFor(node);
  if (!expectedHash)
    return { nodeId, kind: 'npm', reason: 'metadata-missing', ...parsed };
  const expectedSize = expectedSizeFor(node);

  const roots = await findPackageRoots(cwd, parsed.pkgName);
  if (roots.length === 0) {
    return {
      nodeId,
      kind: 'npm',
      reason: 'package-not-found',
      ...parsed,
      expectedHash,
      expectedSize: expectedSize ?? undefined,
      candidates: [],
    };
  }

  const matchingRoots: string[] = [];
  const versionMismatches: string[] = [];
  for (const r of roots) {
    const pkgJsonAbs = path.join(r, 'package.json');
    const obj = await readJson(pkgJsonAbs);
    const name = typeof obj?.name === 'string' ? obj.name : '';
    const ver = typeof obj?.version === 'string' ? obj.version : '';
    if (name === parsed.pkgName && ver === parsed.pkgVersion)
      matchingRoots.push(r);
    else if (name === parsed.pkgName)
      versionMismatches.push(`${r} (version=${ver || 'unknown'})`);
  }
  if (matchingRoots.length === 0) {
    return {
      nodeId,
      kind: 'npm',
      reason: 'package-version-mismatch',
      ...parsed,
      expectedHash,
      expectedSize: expectedSize ?? undefined,
      candidates: versionMismatches.length ? versionMismatches : roots,
    };
  }

  // Try each matching root (stable order) until one satisfies hash/size.
  let last: DependencyValidationMismatch | null = null;
  for (const root of matchingRoots) {
    const fileAbs = path.join(root, ...parsed.pathInPackage.split('/'));
    let actual: { hash: string; size: number } | null = null;
    try {
      actual = await sha256FileAbs(fileAbs);
    } catch {
      last = {
        nodeId,
        kind: 'npm',
        reason: 'file-missing',
        ...parsed,
        candidates: matchingRoots,
      };
      continue;
    }
    if (typeof expectedSize === 'number' && expectedSize !== actual.size) {
      last = {
        nodeId,
        kind: 'npm',
        reason: 'size-mismatch',
        ...parsed,
        expectedHash,
        actualHash: actual.hash,
        expectedSize,
        actualSize: actual.size,
        candidates: matchingRoots,
      };
      continue;
    }
    if (actual.hash !== expectedHash) {
      last = {
        nodeId,
        kind: 'npm',
        reason: 'hash-mismatch',
        ...parsed,
        expectedHash,
        actualHash: actual.hash,
        expectedSize: expectedSize ?? undefined,
        actualSize: actual.size,
        candidates: matchingRoots,
      };
      continue;
    }
    return null;
  }
  return (
    last ?? {
      nodeId,
      kind: 'npm',
      reason: 'hash-mismatch',
      ...parsed,
      expectedHash,
      candidates: matchingRoots,
    }
  );
};

export default { parseNpmNodeId, findPackageRoots, validateNpmNode };
