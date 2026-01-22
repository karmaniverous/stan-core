/**
 * Defines dependency graph meta/state schemas (Zod) for context mode; pure
 * validation/types; no filesystem IO; deterministic formats.
 *
 * Dependency graph mode: on-disk JSON formats for:
 * - .stan/context/dependency.state.json (assistant-authored selection intent)
 * - .stan/context/dependency.meta.json (assistant-facing dependency graph)
 *
 * Requirements:
 * - Node IDs are repo-relative POSIX paths.
 * - State entries support string | [nodeId, depth] | [nodeId, depth, edgeKinds[]]
 *   with defaults depth=0, edgeKinds=['runtime','type','dynamic'].
 * - Meta may include locatorAbs ONLY for abs/outside-root nodes.
 * @module
 */

import { z } from 'zod';

import { normalizeRepoPath } from '@/stan/path/repo';

/** Edge kinds recorded in dependency meta and used by dependency state. */
export const dependencyEdgeTypeSchema = z.enum(['runtime', 'type', 'dynamic']);
export type DependencyEdgeType = z.infer<typeof dependencyEdgeTypeSchema>;

const DEFAULT_EDGE_KINDS: DependencyEdgeType[] = ['runtime', 'type', 'dynamic'];

const nodeIdSchema = z
  .string()
  .min(1)
  .refine((s) => normalizeRepoPath(s) !== null, {
    message: 'nodeId must be a repo-relative POSIX path (no absolute or "..")',
  });

const depthSchema = z.number().int().min(0);

const edgeKindsSchema = z
  .array(dependencyEdgeTypeSchema)
  .nonempty()
  .refine((arr) => {
    // Ensure deterministic ordering to reduce state churn; callers can still
    // pass any order, but we normalize to stable order.
    const set = new Set(arr);
    return set.size === arr.length;
  }, 'edgeKinds must not contain duplicates');

/** A raw entry as stored in dependency.state.json. */
export const dependencyStateEntrySchema = z.union([
  nodeIdSchema,
  z.tuple([nodeIdSchema, depthSchema]),
  z.tuple([nodeIdSchema, depthSchema, edgeKindsSchema]),
]);
export type DependencyStateEntry = z.infer<typeof dependencyStateEntrySchema>;

/** Normalized internal representation of a state entry (defaults applied). */
export type NormalizedDependencyStateEntry = {
  nodeId: string;
  depth: number;
  edgeKinds: DependencyEdgeType[];
};

/** Normalize an entry: apply defaults and canonicalize edgeKinds ordering. */
export const normalizeDependencyStateEntry = (
  e: DependencyStateEntry,
): NormalizedDependencyStateEntry => {
  if (typeof e === 'string') {
    return { nodeId: e, depth: 0, edgeKinds: [...DEFAULT_EDGE_KINDS] };
  }
  const nodeId = e[0];
  const depth = e[1];
  const edgeKinds = Array.isArray(e[2]) ? e[2] : DEFAULT_EDGE_KINDS;
  // Stable order for edgeKinds to minimize churn and simplify comparison.
  const order = new Map<DependencyEdgeType, number>([
    ['runtime', 0],
    ['type', 1],
    ['dynamic', 2],
  ]);
  const sorted = [...edgeKinds].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99),
  );
  return { nodeId, depth, edgeKinds: sorted };
};

export const dependencyStateFileSchema = z
  .object({
    include: z.array(dependencyStateEntrySchema),
    exclude: z.array(dependencyStateEntrySchema).optional(),
  })
  .strict();
export type DependencyStateFile = z.infer<typeof dependencyStateFileSchema>;

/** Parse and normalize state entries (defaults applied; stable edgeKinds). */
export const parseDependencyStateFile = (
  raw: unknown,
): {
  include: NormalizedDependencyStateEntry[];
  exclude: NormalizedDependencyStateEntry[];
} => {
  const parsed = dependencyStateFileSchema.parse(raw);
  return {
    include: parsed.include.map(normalizeDependencyStateEntry),
    exclude: (parsed.exclude ?? []).map(normalizeDependencyStateEntry),
  };
};

/** Dependency meta edge record (minimal, assistant-facing). */
export const dependencyMetaEdgeSchema = z
  .object({
    target: nodeIdSchema,
    kind: dependencyEdgeTypeSchema,
    resolution: z.enum(['explicit', 'implicit']).optional(),
  })
  .strict();
export type DependencyMetaEdge = z.infer<typeof dependencyMetaEdgeSchema>;

/** Per-node metadata expected by the assistant (hash/size when applicable). */
export const dependencyMetaNodeMetadataSchema = z
  .object({
    size: z.number().int().min(0).optional(),
    hash: z.string().min(1).optional(),
  })
  .strict();
export type DependencyMetaNodeMetadata = z.infer<
  typeof dependencyMetaNodeMetadataSchema
>;

/** Dependency meta node (assistant-facing). */
export const dependencyMetaNodeSchema = z
  .object({
    kind: z.enum(['source', 'external', 'builtin', 'missing']),
    metadata: dependencyMetaNodeMetadataSchema.optional(),
    description: z.string().optional(),
    /**
     * locatorAbs is only allowed for abs/outside-root nodes staged under:
     * .stan/context/abs/\<sha256(sourceAbs)\>/<basename>
     */
    locatorAbs: z.string().optional(),
  })
  .strict();
export type DependencyMetaNode = z.infer<typeof dependencyMetaNodeSchema>;

/**
 * Dependency meta file (assistant-facing).
 *
 * Notes:
 * - node IDs are repo-relative POSIX paths.
 * - edges is a complete map (key exists for every nodeId; empty array OK).
 */
export const dependencyMetaFileSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    nodes: z.record(nodeIdSchema, dependencyMetaNodeSchema),
    edges: z.record(nodeIdSchema, z.array(dependencyMetaEdgeSchema)),
  })
  .strict()
  .superRefine((v, ctx) => {
    // Enforce: edges is complete for node IDs present in nodes.
    for (const id of Object.keys(v.nodes)) {
      if (!Object.prototype.hasOwnProperty.call(v.edges, id)) {
        ctx.addIssue({
          code: 'custom',
          message: `edges is missing key for nodeId "${id}"`,
          path: ['edges', id],
        });
      }
    }
    // Enforce: locatorAbs is ONLY for abs-staged nodes.
    // We key this off the standardized staged prefix.
    const absPrefix = '.stan/context/abs/';
    for (const [id, node] of Object.entries(v.nodes)) {
      if (typeof node.locatorAbs === 'string' && node.locatorAbs.length > 0) {
        if (!id.startsWith(absPrefix)) {
          ctx.addIssue({
            code: 'custom',
            message:
              'locatorAbs is only permitted for abs-staged nodeIds under ' +
              `"${absPrefix}"`,
            path: ['nodes', id, 'locatorAbs'],
          });
        }
      }
    }
  });
export type DependencyMetaFile = z.infer<typeof dependencyMetaFileSchema>;

export default {
  dependencyEdgeTypeSchema,
  dependencyStateEntrySchema,
  dependencyStateFileSchema,
  dependencyMetaFileSchema,
  normalizeDependencyStateEntry,
  parseDependencyStateFile,
};
