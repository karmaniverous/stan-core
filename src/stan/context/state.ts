/**
 * Computes dependency selection closure from meta+state (depth + edgeKinds);
 * deterministic BFS; pure graph traversal; no filesystem IO.
 *
 * Dependency graph mode: compute selected node IDs from:
 * - dependency.meta.json edges
 * - dependency.state.json include/exclude entries
 *
 * Requirements:
 * - Depth semantics: 0 =\> node only (no traversal).
 * - Traverse outgoing edges only, restricted by edgeKinds.
 * - Deterministic selection: stable ordering across runs for identical inputs.
 * - Excludes win: subtract after includes using same traversal semantics.
 * @module
 */

import { uniqSortedStrings } from '@/stan/util/array/uniq';

import type {
  DependencyMetaFile,
  NormalizedDependencyStateEntry,
} from './schema';

type Edge = { target: string; kindMask: number };

const getOutgoing = (
  meta: DependencyMetaFile,
  nodeId: string,
  allowedMask: number,
): Edge[] => {
  const node = meta.n[nodeId];
  if (!node || !node.e) return [];

  const out: Edge[] = [];
  for (const tuple of node.e) {
    const target = tuple[0];
    const edgeMask = tuple[1];
    // If edge has ANY bit that is allowed, we follow it?
    // Or MUST the edge bit be present in allowed?
    // Typically: if (edge.kind & allowedMask)
    if ((edgeMask & allowedMask) !== 0) {
      out.push({ target, kindMask: edgeMask });
    }
  }

  // Deterministic traversal: sort by target.
  // (V2 edges are unique by target in the compact tuple list)
  return out.sort((a, b) => a.target.localeCompare(b.target));
};

type QueueItem = { nodeId: string; remaining: number };

/**
 * Expand a single state entry into a set of nodeIds (node + closure).
 * BFS is used so depth is intuitive and deterministic.
 */
export const expandEntry = (
  meta: DependencyMetaFile,
  entry: NormalizedDependencyStateEntry,
): Set<string> => {
  const out = new Set<string>();

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

    const nextEdges = getOutgoing(meta, cur.nodeId, entry.kindMask);
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
  meta: DependencyMetaFile;
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

  return uniqSortedStrings(final);
};

export default { expandEntry, computeSelectedNodeIds };
