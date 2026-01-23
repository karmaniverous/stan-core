/**
 * Validates abs-staged dependency nodes for undo/redo (hash/size against
 * locatorAbs); filesystem IO only; no console output.
 * @module
 */

import type { DependencyMetaNode } from '../schema';
import type { DependencyValidationMismatch } from './types';
import { sha256FileAbs } from './util/hash';

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

export const validateAbsNode = async (args: {
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

export default { validateAbsNode };
