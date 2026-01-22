/* src/stan/context/validate.ts
 * Strict dependency selection validation for undo/redo.
 *
 * Requirements:
 * - Validate that the selected dependency set (from meta+state closure) can be
 *   satisfied by the current environment.
 * - npm nodes:
 *   - locate <pkgName>@<pkgVersion> in current install
 *   - hash-check <pathInPackage> against meta.nodes[nodeId].metadata.hash
 * - abs nodes:
 *   - hash-check locatorAbs against meta.nodes[nodeId].metadata.hash
 * - Fail-fast is supported via validateDependencySelectionOrThrow.
 * - No console I/O; deterministic ordering.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import type { DependencyMetaFile, DependencyMetaNode } from './schema';
import { parseDependencyStateFile } from './schema';
import { computeSelectedNodeIds } from './state';

const toPosix = (p: string): string => p.replace(/\\/g, '/');

const normalize = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalize(prefix);
  const b = normalize(rel);
  return b === a || b.startsWith(`${a}/`);
};

const sha256Hex = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

const sha256FileAbs = async (
  abs: string,
): Promise<{ hash: string; size: number }> => {
  const buf = await readFile(abs);
  return { hash: sha256Hex(buf), size: buf.length };
};

type NpmRef = { pkgName: string; pkgVersion: string; pathInPackage: string };

const parseNpmNodeId = (stanPath: string, nodeId: string): NpmRef | null => {
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
    const raw = await readFile(abs, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const findPackageRoots = async (
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

export type DependencyValidationMismatch =
  | {
      nodeId: string;
      kind: 'npm';
      reason:
        | 'invalid-nodeId'
        | 'meta-missing'
        | 'metadata-missing'
        | 'package-not-found'
        | 'package-version-mismatch'
        | 'file-missing'
        | 'hash-mismatch'
        | 'size-mismatch';
      pkgName?: string;
      pkgVersion?: string;
      pathInPackage?: string;
      expectedHash?: string;
      actualHash?: string;
      expectedSize?: number;
      actualSize?: number;
      candidates?: string[];
    }
  | {
      nodeId: string;
      kind: 'abs';
      reason:
        | 'meta-missing'
        | 'metadata-missing'
        | 'locator-missing'
        | 'file-missing'
        | 'hash-mismatch'
        | 'size-mismatch';
      locatorAbs?: string;
      expectedHash?: string;
      actualHash?: string;
      expectedSize?: number;
      actualSize?: number;
    };

export type ValidateDependencySelectionResult = {
  ok: boolean;
  selectedNodeIds: string[];
  checkedNodeIds: string[];
  mismatches: DependencyValidationMismatch[];
};

const getNode = (
  meta: Pick<DependencyMetaFile, 'nodes'>,
  nodeId: string,
): DependencyMetaNode | undefined => meta.nodes[nodeId];

const expectedHashFor = (
  node: DependencyMetaNode | undefined,
): string | null => {
  const h = node?.metadata?.hash;
  return typeof h === 'string' && h.length ? h : null;
};

const expectedSizeFor = (
  node: DependencyMetaNode | undefined,
): number | null => {
  const s = node?.metadata?.size;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
};

const validateAbsNode = async (args: {
  nodeId: string;
  node: DependencyMetaNode | undefined;
}): Promise<DependencyValidationMismatch | null> => {
  const { nodeId, node } = args;
  if (!node) return { nodeId, kind: 'abs', reason: 'meta-missing' };

  const expectedHash = expectedHashFor(node);
  if (!expectedHash) return { nodeId, kind: 'abs', reason: 'metadata-missing' };

  const locatorAbs = typeof node.locatorAbs === 'string' ? node.locatorAbs : '';
  if (!locatorAbs.trim())
    return { nodeId, kind: 'abs', reason: 'locator-missing' };

  let actual: { hash: string; size: number } | null = null;
  try {
    actual = await sha256FileAbs(locatorAbs);
  } catch {
    return { nodeId, kind: 'abs', reason: 'file-missing', locatorAbs };
  }

  const expectedSize = expectedSizeFor(node);
  if (typeof expectedSize === 'number' && expectedSize !== actual.size) {
    return {
      nodeId,
      kind: 'abs',
      reason: 'size-mismatch',
      locatorAbs,
      expectedSize,
      actualSize: actual.size,
      expectedHash,
      actualHash: actual.hash,
    };
  }
  if (actual.hash !== expectedHash) {
    return {
      nodeId,
      kind: 'abs',
      reason: 'hash-mismatch',
      locatorAbs,
      expectedHash,
      actualHash: actual.hash,
      expectedSize: expectedSize ?? undefined,
      actualSize: actual.size,
    };
  }
  return null;
};

const validateNpmNode = async (args: {
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

export const validateDependencySelection = async (args: {
  cwd: string;
  stanPath: string;
  meta: Pick<DependencyMetaFile, 'nodes' | 'edges'>;
  state: unknown;
}): Promise<ValidateDependencySelectionResult> => {
  const { cwd, stanPath, meta, state } = args;

  const parsed = parseDependencyStateFile(state);
  const selectedNodeIds = computeSelectedNodeIds({
    meta,
    include: parsed.include,
    exclude: parsed.exclude,
  });

  const checkedNodeIds: string[] = [];
  const mismatches: DependencyValidationMismatch[] = [];

  for (const nodeId of selectedNodeIds) {
    const base = normalize(stanPath);
    if (isUnder(`${base}/context/npm`, nodeId)) {
      checkedNodeIds.push(nodeId);
      const m = await validateNpmNode({
        cwd,
        stanPath,
        nodeId,
        node: getNode(meta, nodeId),
      });
      if (m) mismatches.push(m);
      continue;
    }
    if (isUnder(`${base}/context/abs`, nodeId)) {
      checkedNodeIds.push(nodeId);
      const m = await validateAbsNode({ nodeId, node: getNode(meta, nodeId) });
      if (m) mismatches.push(m);
    }
  }

  return {
    ok: mismatches.length === 0,
    selectedNodeIds,
    checkedNodeIds,
    mismatches,
  };
};

export const validateDependencySelectionOrThrow = async (args: {
  cwd: string;
  stanPath: string;
  meta: Pick<DependencyMetaFile, 'nodes' | 'edges'>;
  state: unknown;
}): Promise<void> => {
  const res = await validateDependencySelection(args);
  if (res.ok) return;
  const msg =
    'dependency selection validation failed:\n' +
    res.mismatches
      .map((m) => {
        if (m.kind === 'npm') {
          return `- npm: ${m.nodeId}: ${m.reason}`;
        }
        return `- abs: ${m.nodeId}: ${m.reason}`;
      })
      .join('\n');
  // Throwing is the intended seam for strict undo/redo failure.
  throw new Error(msg);
};

export default {
  validateDependencySelection,
  validateDependencySelectionOrThrow,
};
