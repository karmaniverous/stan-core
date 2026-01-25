/**
 * Defines dependency graph meta/state schemas (Zod) for context mode; pure
 * validation/types; no filesystem IO; deterministic formats.
 *
 * Dependency graph mode: on-disk JSON formats for:
 * - .stan/context/dependency.state.json (assistant-authored selection intent)
 * - .stan/context/dependency.meta.json (assistant-facing dependency graph)
 * - .stan/context/dependency.map.json (host-private integrity map)
 *
 * Requirements:
 * - Node IDs are repo-relative POSIX paths (archive addresses).
 * - State entries support string | [nodeId, depth] | [nodeId, depth, kindMask]
 * - Meta is compact (minified keys).
 * @module
 */

import { z } from 'zod';

import { normalizeRepoPath } from '@/stan/path/repo';

// Decode tables
export const NODE_KIND = {
  SOURCE: 0,
  EXTERNAL: 1,
  BUILTIN: 2,
  MISSING: 3,
} as const;

export const EDGE_KIND = {
  RUNTIME: 1,
  TYPE: 2,
  DYNAMIC: 4,
} as const;

const nodeIdSchema = z
  .string()
  .min(1)
  .refine((s) => normalizeRepoPath(s) !== null, {
    message: 'nodeId must be a repo-relative POSIX path (no absolute or "..")',
  });

const depthSchema = z.number().int().min(0);

const kindMaskSchema = z.number().int().min(0).max(7);

/** A raw entry as stored in dependency.state.json. */
export const dependencyStateEntrySchema = z.union([
  nodeIdSchema,
  z.tuple([nodeIdSchema, depthSchema]),
  z.tuple([nodeIdSchema, depthSchema, kindMaskSchema]),
]);
export type DependencyStateEntry = z.infer<typeof dependencyStateEntrySchema>;

/** Normalized internal representation of a state entry (defaults applied). */
export type NormalizedDependencyStateEntry = {
  nodeId: string;
  depth: number;
  kindMask: number;
};

const ALL_KINDS = EDGE_KIND.RUNTIME | EDGE_KIND.TYPE | EDGE_KIND.DYNAMIC; // 7

/** Normalize an entry: apply defaults and canonicalize edgeKinds ordering. */
export const normalizeDependencyStateEntry = (
  e: DependencyStateEntry,
): NormalizedDependencyStateEntry => {
  if (typeof e === 'string') {
    return { nodeId: e, depth: 0, kindMask: ALL_KINDS };
  }
  const nodeId = e[0];
  const depth = e[1];
  const kindMask = typeof e[2] === 'number' ? e[2] : ALL_KINDS;
  return { nodeId, depth, kindMask };
};

export const dependencyStateFileSchema = z
  .object({
    v: z.literal(2),
    include: z.array(dependencyStateEntrySchema).optional(),
    /** Aliased key for "include" to match minified schema (v2). */
    i: z.array(dependencyStateEntrySchema).optional(),
    exclude: z.array(dependencyStateEntrySchema).optional(),
    /** Aliased key for "exclude" to match minified schema (v2). */
    x: z.array(dependencyStateEntrySchema).optional(),
  })
  .strict();
export type DependencyStateFile = z.infer<typeof dependencyStateFileSchema>;

/** Parse and normalize state entries (defaults applied). */
export const parseDependencyStateFile = (
  raw: unknown,
): {
  include: NormalizedDependencyStateEntry[];
  exclude: NormalizedDependencyStateEntry[];
} => {
  const parsed = dependencyStateFileSchema.parse(raw);
  const inc = parsed.i ?? parsed.include ?? [];
  const exc = parsed.x ?? parsed.exclude ?? [];
  return {
    include: inc.map(normalizeDependencyStateEntry),
    exclude: exc.map(normalizeDependencyStateEntry),
  };
};

/**
 * Dependency meta node (v2 compact).
 */
export const dependencyMetaNodeSchema = z
  .object({
    /** Kind index: 0=source, 1=external, 2=builtin, 3=missing */
    k: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    /** Size in bytes (optional) */
    s: z.number().int().min(0).optional(),
    /** Description (optional) */
    d: z.string().optional(),
    /**
     * Edges: array of tuples.
     * [targetId, kindMask] or [targetId, kindMask, resMask]
     */
    e: z
      .array(
        z.union([
          z.tuple([nodeIdSchema, kindMaskSchema]),
          z.tuple([
            nodeIdSchema,
            kindMaskSchema,
            z.number().int().min(1).max(3),
          ]),
        ]),
      )
      .optional(),
  })
  .strict();
export type DependencyMetaNode = z.infer<typeof dependencyMetaNodeSchema>;

/**
 * Dependency meta file (v2 assistant-facing).
 * Key is canonical NodeId.
 */
export const dependencyMetaFileSchema = z
  .object({
    v: z.literal(2),
    /** Nodes map: id -> node */
    n: z.record(nodeIdSchema, dependencyMetaNodeSchema),
  })
  .strict();
export type DependencyMetaFile = z.infer<typeof dependencyMetaFileSchema>;

/**
 * Dependency Map (host-private).
 * Used for staging verification.
 */
export const dependencyMapNodeSchema = z.object({
  id: z.string(),
  locatorAbs: z.string(),
  size: z.number().int().min(0),
  sha256: z.string(),
});
export const dependencyMapFileSchema = z.object({
  v: z.literal(1),
  nodes: z.record(z.string(), dependencyMapNodeSchema),
});
export type DependencyMapFile = z.infer<typeof dependencyMapFileSchema>;

export default {
  NODE_KIND,
  EDGE_KIND,
  dependencyStateEntrySchema,
  dependencyStateFileSchema,
  dependencyMetaFileSchema,
  dependencyMapFileSchema,
  normalizeDependencyStateEntry,
  parseDependencyStateFile,
};
