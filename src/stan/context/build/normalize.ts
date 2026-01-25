/**
 * Normalizes raw dependency graph nodes/edges into strict meta format.
 * @module
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeAbsExternal,
  normalizeRepoLocal,
  sortRecordKeys,
} from '../normalize';
import { normalizeNpmExternal } from '../npm';
import type {
  DependencyMapFile,
  DependencyMetaFile,
  DependencyMetaNode,
} from '../schema';
import { EDGE_KIND, NODE_KIND } from '../schema';
import type { BuildDependencyMetaResult, NodeSource, RawResult } from './types';

const computeSha256 = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

export const normalizeGraph = async (
  cwd: string,
  stanPath: string,
  raw: RawResult,
): Promise<BuildDependencyMetaResult> => {
  const warnings: string[] = [];
  const graph = raw.graph ?? {};
  const nodesIn = graph.nodes ?? {};
  const edgesIn = graph.edges ?? {};

  if (Array.isArray(raw.errors) && raw.errors.length) {
    for (const e of raw.errors)
      if (typeof e === 'string' && e.trim()) warnings.push(e.trim());
  }

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

  // 1) Normalize nodes and build ID mapping oldId -> newId
  const idMap = new Map<string, string | null>();
  const tempSources: Record<
    string,
    NodeSource & { size?: number; hash?: string }
  > = {};

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
        tempSources[rel] = {
          kind: 'repo',
          size: n.metadata?.size,
          hash: n.metadata?.hash,
        };
      }
      continue;
    }
    if (kind === 'external') {
      const abs = path.isAbsolute(oldId) ? oldId : path.resolve(cwd, oldId);
      const npm = await normalizeNpmExternal(stanPath, abs);
      if (npm) {
        idMap.set(oldId, npm.nodeId);
        tempSources[npm.nodeId] = {
          kind: 'npm',
          sourceAbs: npm.sourceAbsPosix,
          pkgName: npm.pkgName,
          pkgVersion: npm.pkgVersion,
          pathInPackage: npm.pathInPackage,
          size: n.metadata?.size,
          hash: n.metadata?.hash,
        };
      } else {
        const { nodeId, locatorAbs, sourceAbsPosix } = normalizeAbsExternal(
          stanPath,
          abs,
        );
        idMap.set(oldId, nodeId);
        tempSources[nodeId] = {
          kind: 'abs',
          sourceAbs: sourceAbsPosix,
          locatorAbs,
          size: n.metadata?.size,
          hash: n.metadata?.hash,
        };
      }
      continue;
    }
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

  // 2) Build normalized nodes map
  const nodesOut: Record<string, DependencyMetaNode> = {};
  const mapNodes: DependencyMapFile['nodes'] = {};

  // Helper to ensure hash/size availability for map
  const getIntegrity = async (
    src: NodeSource & { size?: number; hash?: string },
  ): Promise<{ s: number; h: string } | null> => {
    if (typeof src.size === 'number' && typeof src.hash === 'string') {
      return { s: src.size, h: src.hash };
    }
    // Fallback: read file if needed (stan-context usually provides metadata)
    // Only strictly needed for externals we stage.
    if ('sourceAbs' in src) {
      try {
        const buf = await readFile(src.sourceAbs);
        return { s: buf.length, h: computeSha256(buf) };
      } catch {
        return null;
      }
    }
    return null;
  };

  for (const [oldId, rawNode] of Object.entries(nodesIn)) {
    const newId = idMap.get(oldId) ?? null;
    if (!newId) continue;

    let k: DependencyMetaNode['k'];
    switch (rawNode.kind) {
      case 'source':
        k = NODE_KIND.SOURCE;
        break;
      case 'external':
        k = NODE_KIND.EXTERNAL;
        break;
      case 'builtin':
        k = NODE_KIND.BUILTIN;
        break;
      default:
        k = NODE_KIND.MISSING;
    }

    const d =
      typeof rawNode.description === 'string' && rawNode.description.trim()
        ? rawNode.description.trim()
        : undefined;
    const size =
      typeof rawNode.metadata?.size === 'number'
        ? rawNode.metadata.size
        : undefined;

    const node: DependencyMetaNode = { k };
    if (size !== undefined) node.s = size;
    if (d) node.d = d;

    nodesOut[newId] = node;

    // Populate Map for externals
    if (k === NODE_KIND.EXTERNAL) {
      const src = tempSources[newId];
      if (src && 'sourceAbs' in src) {
        const integrity = await getIntegrity(src);
        if (integrity) {
          mapNodes[newId] = {
            id: newId,
            locatorAbs: src.sourceAbs, // Use sourceAbs as locator
            size: integrity.s,
            sha256: integrity.h,
          };
        }
      }
    }
  }

  // 3) Build edges
  const keep = new Set(Object.keys(nodesOut));

  for (const [oldSource, list] of Object.entries(edgesIn)) {
    const src = idMap.get(oldSource) ?? null;
    if (!src || !nodesOut[src]) continue;

    // Group edges by target
    const byTarget = new Map<string, { kMask: number; resMask: number }>();

    for (const e of list) {
      const tOld = typeof e.target === 'string' ? e.target : null;
      if (!tOld) continue;
      const t = idMap.get(tOld) ?? null;
      if (!t || !keep.has(t)) continue;

      let kBit = 0;
      if (e.kind === 'runtime') kBit = EDGE_KIND.RUNTIME;
      else if (e.kind === 'type') kBit = EDGE_KIND.TYPE;
      else if (e.kind === 'dynamic') kBit = EDGE_KIND.DYNAMIC;
      if (!kBit) continue;

      let rBit = 1; // Explicit default
      if (e.resolution === 'implicit') rBit = 2;
      // If 'explicit', rBit = 1.

      const existing = byTarget.get(t);
      const prev = existing ? existing : { kMask: 0, resMask: 0 };
      byTarget.set(t, {
        kMask: prev.kMask | kBit,
        resMask: prev.resMask | rBit,
      });
    }

    const edgeList: NonNullable<DependencyMetaNode['e']> = [];
    // Sort targets
    const targets = Array.from(byTarget.keys()).sort();
    for (const t of targets) {
      const info = byTarget.get(t);
      if (!info) continue;
      // Compact tuple: [target, kMask] or [target, kMask, resMask]
      // Omit resMask if explicit-only (1)
      if (info.resMask === 1) {
        edgeList.push([t, info.kMask]);
      } else {
        edgeList.push([t, info.kMask, info.resMask]);
      }
    }

    if (edgeList.length > 0) {
      nodesOut[src].e = edgeList;
    }
  }

  const meta: DependencyMetaFile = {
    v: 2,
    n: sortRecordKeys(nodesOut),
  };

  const map: DependencyMapFile = {
    v: 1,
    nodes: sortRecordKeys(mapNodes),
  };

  return { meta, map, warnings, stats: statsOut };
};
