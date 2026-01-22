/* src/stan/context/build.ts
 * Build assistant-facing dependency.meta.json for dependency graph mode.
 *
 * Requirements:
 * - Invoked only when context mode is enabled by the caller (CLI).
 * - Must throw if TypeScript cannot be imported (context mode requires TS).
 * - Must dynamically import @karmaniverous/stan-context only when invoked.
 * - Must normalize external node IDs to staged paths under <stanPath>/context:
 *   - npm: <stanPath>/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>
 *   - abs/outside-root: <stanPath>/context/abs/<sha256(sourceAbs)>/<basename>
 * - Must omit builtins and missing nodes from persisted meta (surface as warnings).
 * - Must produce deterministic JSON-serializable nodes/edges and validate with dependencyMetaFileSchema.
 */
import path from 'node:path';

import { loadStanContext, loadTypeScript } from './deps';
import {
  normalizeAbsExternal,
  normalizeMetadata,
  normalizeRepoLocal,
  sortRecordKeys,
  toPosix,
} from './normalize';
import { normalizeNpmExternal } from './npm';
import type { DependencyMetaFile, DependencyMetaNode } from './schema';
import { dependencyMetaFileSchema } from './schema';

type GraphNode = {
  kind?: 'source' | 'external' | 'builtin' | 'missing';
  metadata?: { size?: number; hash?: string };
  description?: string;
};
type GraphEdge = {
  target?: string;
  kind?: 'runtime' | 'type' | 'dynamic';
  resolution?: 'explicit' | 'implicit';
};
type Graph = {
  nodes?: Record<string, GraphNode>;
  edges?: Record<string, GraphEdge[]>;
};

export type BuildDependencyMetaArgs = {
  cwd: string;
  stanPath: string;
  selection?: { includes?: string[]; excludes?: string[]; anchors?: string[] };
  nodeDescriptionLimit?: number;
  nodeDescriptionTags?: string[];
  maxErrors?: number;
};

export type NodeSource =
  | { kind: 'repo' }
  | {
      kind: 'npm';
      sourceAbs: string;
      pkgName: string;
      pkgVersion: string;
      pathInPackage: string;
    }
  | { kind: 'abs'; sourceAbs: string; locatorAbs: string };

export type BuildDependencyMetaResult = {
  meta: DependencyMetaFile;
  sources: Record<string, NodeSource>;
  warnings: string[];
  stats?: { modules: number; edges: number; dirty: number };
};

export const buildDependencyMeta = async (
  args: BuildDependencyMetaArgs,
): Promise<BuildDependencyMetaResult> => {
  const {
    cwd,
    stanPath,
    selection,
    nodeDescriptionLimit,
    nodeDescriptionTags,
    maxErrors,
  } = args;
  const warnings: string[] = [];

  // Enforce: TypeScript must be present when dependency graph mode is invoked.
  try {
    await loadTypeScript();
  } catch {
    throw new Error(
      'dependency graph mode requires TypeScript; install "typescript" in this environment',
    );
  }

  let generateDependencyGraph: (opts: unknown) => Promise<unknown>;
  try {
    const mod = await loadStanContext();
    generateDependencyGraph = mod.generateDependencyGraph;
  } catch {
    throw new Error(
      'dependency graph mode requires @karmaniverous/stan-context; install it alongside stan-core (stan-cli includes it)',
    );
  }

  const raw = (await generateDependencyGraph({
    cwd,
    config: selection ?? {},
    nodeDescriptionLimit,
    nodeDescriptionTags,
    maxErrors,
  })) as { graph?: Graph; stats?: unknown; errors?: unknown };

  const graph: Graph = raw.graph ?? {};
  const stats =
    raw.stats && typeof raw.stats === 'object'
      ? (raw.stats as { modules?: number; edges?: number; dirty?: number })
      : undefined;
  const statsOut =
    stats &&
    typeof stats.modules === 'number' &&
    typeof stats.edges === 'number' &&
    typeof stats.dirty === 'number'
      ? { modules: stats.modules, edges: stats.edges, dirty: stats.dirty }
      : undefined;

  if (Array.isArray(raw.errors) && raw.errors.length) {
    for (const e of raw.errors)
      if (typeof e === 'string' && e.trim()) warnings.push(e.trim());
  }

  const nodesIn = graph.nodes ?? {};
  const edgesIn = graph.edges ?? {};

  // 1) Normalize nodes and build ID mapping oldId -> newId (or null if dropped).
  const idMap = new Map<string, string | null>();
  const sources: Record<string, NodeSource> = {};

  let droppedBuiltin = 0;
  let droppedMissing = 0;

  for (const [oldId, n] of Object.entries(nodesIn)) {
    const kind = n.kind;

    if (kind === 'builtin') {
      idMap.set(oldId, null);
      droppedBuiltin += 1;
      continue;
    }
    if (kind === 'missing') {
      idMap.set(oldId, null);
      droppedMissing += 1;
      continue;
    }

    if (kind === 'source') {
      const rel = normalizeRepoLocal(cwd, oldId);
      if (!rel) {
        idMap.set(oldId, null);
        warnings.push(
          `dependency graph: dropped un-normalizable source nodeId "${oldId}"`,
        );
      } else {
        idMap.set(oldId, rel);
        sources[rel] = { kind: 'repo' };
      }
      continue;
    }

    if (kind === 'external') {
      const abs = path.isAbsolute(oldId) ? oldId : path.resolve(cwd, oldId);
      // Prefer npm normalization when a package boundary exists; else treat as abs.
      const npm = await normalizeNpmExternal(stanPath, abs);
      if (npm) {
        idMap.set(oldId, npm.nodeId);
        sources[npm.nodeId] = {
          kind: 'npm',
          sourceAbs: npm.sourceAbsPosix,
          pkgName: npm.pkgName,
          pkgVersion: npm.pkgVersion,
          pathInPackage: npm.pathInPackage,
        };
      } else {
        const { nodeId, locatorAbs, sourceAbsPosix } = normalizeAbsExternal(
          stanPath,
          abs,
        );
        idMap.set(oldId, nodeId);
        sources[nodeId] = {
          kind: 'abs',
          sourceAbs: sourceAbsPosix,
          locatorAbs,
        };
      }
      continue;
    }

    // Unknown/absent kind — drop.
    idMap.set(oldId, null);
    warnings.push(
      `dependency graph: dropped nodeId "${oldId}" with unknown kind`,
    );
  }

  if (droppedBuiltin > 0)
    warnings.push(
      `dependency graph: omitted ${droppedBuiltin.toString()} builtin node(s) from persisted meta`,
    );
  if (droppedMissing > 0)
    warnings.push(
      `dependency graph: omitted ${droppedMissing.toString()} missing node(s) from persisted meta`,
    );

  // 2) Build normalized nodes map.
  const nodesOut: Record<string, DependencyMetaNode> = {};
  for (const [oldId, n] of Object.entries(nodesIn)) {
    const newId = idMap.get(oldId) ?? null;
    if (!newId) continue;

    const metadata = normalizeMetadata(n.metadata);
    const description =
      typeof n.description === 'string' && n.description.trim()
        ? n.description.trim()
        : undefined;

    const kind: DependencyMetaNode['kind'] =
      n.kind === 'source' ? 'source' : 'external';

    const node: DependencyMetaNode = {
      kind,
      ...(metadata ? { metadata } : {}),
      ...(description ? { description } : {}),
    };

    // Abs nodes: attach locatorAbs (required for strict undo validation later)
    if (newId.startsWith(`${toPosix(stanPath)}/context/abs/`)) {
      if (Object.prototype.hasOwnProperty.call(sources, newId)) {
        const src = sources[newId];
        if (src.kind === 'abs') node.locatorAbs = src.locatorAbs;
      }
    }

    nodesOut[newId] = node;
  }

  // 3) Build normalized edges map: only keep edges whose source+target survived normalization.
  const keep = new Set(Object.keys(nodesOut));
  const edgesOut: Record<
    string,
    Array<{
      target: string;
      kind: 'runtime' | 'type' | 'dynamic';
      resolution?: 'explicit' | 'implicit';
    }>
  > = {};

  for (const [oldSource, list] of Object.entries(edgesIn)) {
    const src = idMap.get(oldSource) ?? null;
    if (!src || !keep.has(src)) continue;

    const next: Array<{
      target: string;
      kind: 'runtime' | 'type' | 'dynamic';
      resolution?: 'explicit' | 'implicit';
    }> = [];
    for (const e of list) {
      const tOld = typeof e.target === 'string' ? e.target : null;
      const kind = e.kind;
      if (!tOld) continue;
      const t = idMap.get(tOld) ?? null;
      if (!t || !keep.has(t)) continue;
      if (kind !== 'runtime' && kind !== 'type' && kind !== 'dynamic') continue;
      const resolution =
        e.resolution === 'explicit' || e.resolution === 'implicit'
          ? e.resolution
          : undefined;
      next.push({ target: t, kind, ...(resolution ? { resolution } : {}) });
    }
    // Deterministic ordering + de-dupe
    next.sort((a, b) =>
      a.target === b.target
        ? a.kind === b.kind
          ? (a.resolution ?? '').localeCompare(b.resolution ?? '')
          : a.kind.localeCompare(b.kind)
        : a.target.localeCompare(b.target),
    );
    const uniq: typeof next = [];
    for (const e of next) {
      const prev = uniq.at(-1);
      if (
        prev &&
        prev.target === e.target &&
        prev.kind === e.kind &&
        (prev.resolution ?? '') === (e.resolution ?? '')
      ) {
        continue;
      }
      uniq.push(e);
    }
    edgesOut[src] = uniq;
  }

  // Ensure edges key exists for every node (schema requires completeness).
  for (const id of keep)
    if (!Object.prototype.hasOwnProperty.call(edgesOut, id)) edgesOut[id] = [];

  const meta: DependencyMetaFile = dependencyMetaFileSchema.parse({
    schemaVersion: 1,
    nodes: sortRecordKeys(nodesOut),
    edges: sortRecordKeys(edgesOut),
  });

  return { meta, sources, warnings, stats: statsOut };
};

export default { buildDependencyMeta };
