/* src/stan/context/state.ts
 * Dependency graph mode: compute selected node IDs from:
 * - dependency.meta.json edges
 * - dependency.state.json include/exclude entries
 *
 * Requirements:
 * - Depth semantics: 0 => node only (no traversal).
 * - Traverse outgoing edges only, restricted by edgeKinds.
 * - Deterministic selection: stable ordering across runs for identical inputs.
 * - Excludes win: subtract after includes using same traversal semantics.
 */

import type {
  DependencyEdgeType,
  DependencyMetaFile,
  NormalizedDependencyStateEntry,
} from './schema';

const sortUnique = (arr: string[]): string[] =>
  Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

const allowedKinds = (kinds: DependencyEdgeType[]): Set<DependencyEdgeType> =>
  new Set(kinds);

type Edge = { target: string; kind: DependencyEdgeType };

const getOutgoing = (
  meta: Pick<DependencyMetaFile, 'edges'>,
  nodeId: string,
  kinds: Set<DependencyEdgeType>,
): Edge[] => {
  const list = meta.edges[nodeId] ?? [];
  const filtered = list.filter((e) => kinds.has(e.kind));
  // Deterministic traversal: sort by (target, kind).
  return filtered
    .map((e) => ({ target: e.target, kind: e.kind }))
    .sort((a, b) =>
      a.target === b.target
        ? a.kind.localeCompare(b.kind)
        : a.target.localeCompare(b.target),
    );
};

type QueueItem = { nodeId: string; remaining: number };

/**
 * Expand a single state entry into a set of nodeIds (node + closure).
 * BFS is used so depth is intuitive and deterministic.
 */
export const expandEntry = (
  meta: Pick<DependencyMetaFile, 'edges'>,
  entry: NormalizedDependencyStateEntry,
): Set<string> => {
  const out = new Set<string>();
  const kinds = allowedKinds(entry.edgeKinds);

  const q: QueueItem[] = [{ nodeId: entry.nodeId, remaining: entry.depth }];

  // visited tracks the max remaining depth seen for each nodeId.
  // If we reach the same node with <= remaining than before, skip.
  const visited = new Map<string, number>();

  while (q.length) {
    const cur = q.shift() as QueueItem;
    const prevRemain = visited.get(cur.nodeId);
    if (typeof prevRemain === 'number' && prevRemain >= cur.remaining) continue;
    visited.set(cur.nodeId, cur.remaining);

    out.add(cur.nodeId);
    if (cur.remaining <= 0) continue;

    const nextEdges = getOutgoing(meta, cur.nodeId, kinds);
    for (const e of nextEdges) {
      q.push({ nodeId: e.target, remaining: cur.remaining - 1 });
    }
  }

  return out;
};

/**
 * Compute final selected nodeIds from include/exclude entries.
 * Excludes win (subtract after includes).
 */
export const computeSelectedNodeIds = (args: {
  meta: Pick<DependencyMetaFile, 'edges'>;
  include: NormalizedDependencyStateEntry[];
  exclude: NormalizedDependencyStateEntry[];
}): string[] => {
  const { meta, include, exclude } = args;

  const includeSet = new Set<string>();
  for (const e of include) {
    for (const id of expandEntry(meta, e)) includeSet.add(id);
  }

  const excludeSet = new Set<string>();
  for (const e of exclude) {
    for (const id of expandEntry(meta, e)) excludeSet.add(id);
  }

  const final: string[] = [];
  for (const id of includeSet) if (!excludeSet.has(id)) final.push(id);

  return sortUnique(final);
};

export default { expandEntry, computeSelectedNodeIds };
