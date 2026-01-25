/**
 * Validates selected dependency nodes for undo/redo (npm pkg\@version + abs
 * locator hash/size checks) against the host-private dependency map;
 * filesystem IO only; no console output.
 * @module
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { isUnder, normalizePrefix } from '@/stan/path/prefix';

import type { DependencyMapFile, DependencyMetaFile } from './schema';
import { parseDependencyStateFile } from './schema';
import { computeSelectedNodeIds } from './state';
import type {
  DependencyValidationMismatch,
  ValidateDependencySelectionResult,
} from './validate/types';

export type { DependencyValidationMismatch, ValidateDependencySelectionResult };

const computeSha256 = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

/**
 * Validate that the selected dependency set (from meta+state closure) can be
 * satisfied by the current environment.
 *
 * - Computes selected node IDs from meta+state closure (excludes win).
 * - Validates external nodes (npm/abs) against `dependency.map.json`.
 *
 * @param args - Validation inputs.
 * @returns Validation result with deterministic mismatches.
 */
export const validateDependencySelection = async (args: {
  stanPath: string;
  meta: DependencyMetaFile;
  map: DependencyMapFile;
  state: unknown;
}): Promise<ValidateDependencySelectionResult> => {
  const { stanPath, meta, map, state } = args;

  const parsed = parseDependencyStateFile(state);
  const selectedNodeIds = computeSelectedNodeIds({
    meta,
    include: parsed.include,
    exclude: parsed.exclude,
  });

  const mismatches: DependencyValidationMismatch[] = [];

  const base = normalizePrefix(stanPath);

  for (const nodeId of selectedNodeIds) {
    // Only validate externals (staged)
    if (
      isUnder(`${base}/context/npm`, nodeId) ||
      isUnder(`${base}/context/abs`, nodeId)
    ) {
      const entry = map.nodes[nodeId];
      if (!entry) {
        mismatches.push({ nodeId, reason: 'map-missing' });
        continue;
      }

      let buf: Buffer;
      try {
        buf = await readFile(entry.locatorAbs);
      } catch {
        mismatches.push({
          nodeId,
          reason: 'file-missing',
          locatorAbs: entry.locatorAbs,
        });
        continue;
      }

      if (buf.length !== entry.size) {
        mismatches.push({
          nodeId,
          reason: 'size-mismatch',
          locatorAbs: entry.locatorAbs,
          expectedSize: entry.size,
          actualSize: buf.length,
        });
        continue;
      }

      const hash = computeSha256(buf);
      if (hash !== entry.sha256) {
        mismatches.push({
          nodeId,
          reason: 'hash-mismatch',
          locatorAbs: entry.locatorAbs,
          expectedHash: entry.sha256,
          actualHash: hash,
        });
      }
    }
  }

  return {
    ok: mismatches.length === 0,
    selectedNodeIds,
    mismatches,
  };
};

/**
 * Validate dependency selection and throw on mismatch (strict undo/redo seam).
 */
export const validateDependencySelectionOrThrow = async (args: {
  stanPath: string;
  meta: DependencyMetaFile;
  map: DependencyMapFile;
  state: unknown;
}): Promise<void> => {
  const res = await validateDependencySelection(args);
  if (res.ok) return;
  const msg =
    'dependency selection validation failed:\n' +
    res.mismatches
      .map((m) => {
        return `- ${m.nodeId}: ${m.reason}`;
      })
      .join('\n');
  throw new Error(msg);
};

export default {
  validateDependencySelection,
  validateDependencySelectionOrThrow,
};
