/**
 * Validates selected dependency nodes for undo/redo (npm pkg\@version + abs
 * locator hash/size checks); filesystem IO only; no console output.
 * @module
 */
import type { DependencyMetaFile, DependencyMetaNode } from './schema';
import { parseDependencyStateFile } from './schema';
import { computeSelectedNodeIds } from './state';
import { validateAbsNode } from './validate/abs';
import { validateNpmNode } from './validate/npm';
import type {
  DependencyValidationMismatch,
  ValidateDependencySelectionResult,
} from './validate/types';
import { isUnder, normalize } from './validate/util/path';

export type { DependencyValidationMismatch, ValidateDependencySelectionResult };

/**
 * Validate that the selected dependency set (from meta+state closure) can be
 * satisfied by the current environment.
 *
 * - Computes selected node IDs from meta+state closure (excludes win).
 * - Validates external nodes only:
 *   - npm nodes under `<stanPath>/context/npm/**` by locating `<pkgName>@<pkgVersion>`
 *     in the current install and hashing `<pathInPackage>`.
 *   - abs nodes under `<stanPath>/context/abs/**` by hashing `locatorAbs`.
 *
 * @param args - Validation inputs.
 * @returns Validation result with deterministic mismatches.
 */
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

  const base = normalize(stanPath);

  const getNode = (nodeId: string): DependencyMetaNode | undefined =>
    meta.nodes[nodeId];

  for (const nodeId of selectedNodeIds) {
    if (isUnder(`${base}/context/npm`, nodeId)) {
      checkedNodeIds.push(nodeId);
      const m = await validateNpmNode({
        cwd,
        stanPath,
        nodeId,
        node: getNode(nodeId),
      });
      if (m) mismatches.push(m);
      continue;
    }
    if (isUnder(`${base}/context/abs`, nodeId)) {
      checkedNodeIds.push(nodeId);
      const m = await validateAbsNode({ nodeId, node: getNode(nodeId) });
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

/**
 * Validate dependency selection and throw on mismatch (strict undo/redo seam).
 *
 * @param args - Validation inputs.
 * @returns Resolves when validation passes; throws when mismatches exist.
 */
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
        if (m.kind === 'npm') return `- npm: ${m.nodeId}: ${m.reason}`;
        return `- abs: ${m.nodeId}: ${m.reason}`;
      })
      .join('\n');
  throw new Error(msg);
};

export default {
  validateDependencySelection,
  validateDependencySelectionOrThrow,
};
