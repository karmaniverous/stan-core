/**
 * Normalizes raw dependency graph nodes/edges into strict meta format.
 * @module
 */
import path from 'node:path';

import {
  normalizeAbsExternal,
  normalizeMetadata,
  normalizeRepoLocal,
  sortRecordKeys,
  toPosix,
} from '../normalize';
import { normalizeNpmExternal } from '../npm';
import type { DependencyMetaFile, DependencyMetaNode } from '../schema';
import { dependencyMetaFileSchema } from '../schema';
import type { BuildDependencyMetaResult, NodeSource, RawResult } from './types';

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
    if (newId.startsWith(`${toPosix(stanPath)}/context/abs/`)) {
      const src = sources[newId];
      if (src && src.kind === 'abs') node.locatorAbs = src.locatorAbs;
    }
    nodesOut[newId] = node;
  }

  // 3) Build normalized edges map
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
    const next: (typeof edgesOut)[string] = [];
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

  for (const id of keep)
    if (!Object.prototype.hasOwnProperty.call(edgesOut, id)) edgesOut[id] = [];

  const meta: DependencyMetaFile = dependencyMetaFileSchema.parse({
    schemaVersion: 1,
    nodes: sortRecordKeys(nodesOut),
    edges: sortRecordKeys(edgesOut),
  });

  return { meta, sources, warnings, stats: statsOut };
};
