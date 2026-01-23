/**
 * Orchestrates dependency-graph archive flows (stage context + add anchors);
 * calls archive/diff helpers; filesystem IO only; no console output.
 *
 * Dependency graph mode: orchestration helpers for CLI-facing archive flows.
 *
 * Requirements:
 * - Stage dependency external bytes (npm + abs) into <stanPath>/context/** before archiving.
 * - Prefer staging ONLY the selected nodeId set derived from dependency state closure to avoid bloat.
 * - Ensure <stanPath>/context/** is included in archives even when gitignored (use includes).
 * - No console I/O; keep behavior deterministic.
 * @module
 */
import type { CreateArchiveOptions } from '../archive';
import { createArchive } from '../archive';
import type { SnapshotUpdateMode } from '../diff';
import { createArchiveDiff } from '../diff';
import type { NodeSource } from './build';
import type {
  DependencyEdgeType,
  DependencyMetaFile,
  DependencyMetaNode,
} from './schema';
import { parseDependencyStateFile } from './schema';
import type { StageDependencyContextResult } from './stage';
import { stageDependencyContext } from './stage';
import { computeSelectedNodeIds } from './state';

const toPosix = (p: string): string => p.replace(/\\/g, '/');

const normalizePrefix = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const uniq = (xs: string[]): string[] => Array.from(new Set(xs));

const contextIncludeGlob = (stanPath: string): string =>
  `${normalizePrefix(stanPath)}/context/**`;

const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalizePrefix(prefix);
  const b = normalizePrefix(rel);
  return b === a || b.startsWith(`${a}/`);
};

const isStageableNodeId = (stanPath: string, nodeId: string): boolean => {
  const base = normalizePrefix(stanPath);
  const rel = normalizePrefix(nodeId);
  return (
    isUnder(`${base}/context/npm`, rel) || isUnder(`${base}/context/abs`, rel)
  );
};

export type DependencyContextMeta = Pick<DependencyMetaFile, 'edges'> & {
  // Widen nodes index signature for safe runtime existence semantics.
  nodes: Record<string, DependencyMetaNode | undefined>;
};

export type DependencyContextInputs = {
  meta: DependencyContextMeta;
  /**
   * Dependency selection state (assistant-authored).
   * When present, used to compute a selected closure and stage only those nodes.
   * When absent, staging falls back to "all stageable nodes in sources".
   */
  state?: unknown;
  /**
   * Node source locators (produced by buildDependencyMeta).
   * Strongly recommended for npm nodes; abs nodes may also be staged using locatorAbs from meta.
   */
  sources?: Record<string, NodeSource>;
};

export type PrepareDependencyContextResult = {
  /** Include globs required to include <stanPath>/context/** even if gitignored. */
  includes: string[];
  /** Node IDs selected by state closure (empty when state not provided). */
  selectedNodeIds: string[];
  /** Node IDs that should be staged (subset of selected, stageable only). */
  stageNodeIds: string[];
};

export const prepareDependencyContext = (args: {
  stanPath: string;
  meta: DependencyContextMeta;
  state?: unknown;
  /** Optional override when state is omitted (default: stage all stageable nodes in sources). */
  nodeIdsWhenNoState?: string[];
}): PrepareDependencyContextResult => {
  const { stanPath, meta, state, nodeIdsWhenNoState } = args;

  const includes = [contextIncludeGlob(stanPath)];

  if (typeof state === 'undefined') {
    const fallback = Array.isArray(nodeIdsWhenNoState)
      ? nodeIdsWhenNoState
      : [];
    const stageNodeIds = uniq(fallback.map(normalizePrefix)).filter((id) =>
      isStageableNodeId(stanPath, id),
    );
    return { includes, selectedNodeIds: [], stageNodeIds };
  }

  const parsed = parseDependencyStateFile(state);
  const selectedNodeIds = computeSelectedNodeIds({
    meta,
    include: parsed.include,
    exclude: parsed.exclude,
  });

  const stageNodeIds = selectedNodeIds.filter((id) =>
    isStageableNodeId(stanPath, id),
  );
  return { includes, selectedNodeIds, stageNodeIds };
};

export type StagePreparedDependencyContextResult =
  PrepareDependencyContextResult & {
    stage: StageDependencyContextResult;
  };

export const stagePreparedDependencyContext = async (args: {
  cwd: string;
  stanPath: string;
  meta: DependencyContextMeta;
  sources?: Record<string, NodeSource>;
  plan: PrepareDependencyContextResult;
  clean?: boolean;
}): Promise<StagePreparedDependencyContextResult> => {
  const { cwd, stanPath, meta, sources, plan, clean = false } = args;

  // If no state was provided, stageNodeIds may be empty; caller can pass a fallback list.
  const stage = await stageDependencyContext({
    cwd,
    stanPath,
    meta: { nodes: meta.nodes },
    sources,
    nodeIds: plan.stageNodeIds.length ? plan.stageNodeIds : undefined,
    clean,
  });

  return { ...plan, stage };
};

export type CreateArchiveWithDependencyContextResult =
  StagePreparedDependencyContextResult & { archivePath: string };

export const createArchiveWithDependencyContext = async (args: {
  cwd: string;
  stanPath: string;
  dependency: DependencyContextInputs & { clean?: boolean };
  archive?: CreateArchiveOptions;
}): Promise<CreateArchiveWithDependencyContextResult> => {
  const { cwd, stanPath, dependency, archive } = args;
  const plan = prepareDependencyContext({
    stanPath,
    meta: dependency.meta,
    state: dependency.state,
    nodeIdsWhenNoState: Object.keys(dependency.sources ?? {}),
  });

  const staged = await stagePreparedDependencyContext({
    cwd,
    stanPath,
    meta: dependency.meta,
    sources: dependency.sources,
    plan,
    clean: dependency.clean ?? false,
  });

  const includes = uniq([...(archive?.includes ?? []), ...plan.includes]);
  const archivePath = await createArchive(cwd, stanPath, {
    ...(archive ?? {}),
    includes,
  });

  return { ...staged, archivePath };
};

export type CreateArchiveDiffWithDependencyContextResult =
  StagePreparedDependencyContextResult & { diffPath: string };

export const createArchiveDiffWithDependencyContext = async (args: {
  cwd: string;
  stanPath: string;
  dependency: DependencyContextInputs & { clean?: boolean };
  diff: {
    baseName: string;
    includes?: string[];
    excludes?: string[];
    updateSnapshot?: SnapshotUpdateMode;
    includeOutputDirInDiff?: boolean;
    onArchiveWarnings?: (text: string) => void;
  };
}): Promise<CreateArchiveDiffWithDependencyContextResult> => {
  const { cwd, stanPath, dependency, diff } = args;

  const plan = prepareDependencyContext({
    stanPath,
    meta: dependency.meta,
    state: dependency.state,
    nodeIdsWhenNoState: Object.keys(dependency.sources ?? {}),
  });

  const staged = await stagePreparedDependencyContext({
    cwd,
    stanPath,
    meta: dependency.meta,
    sources: dependency.sources,
    plan,
    clean: dependency.clean ?? false,
  });

  const includes = uniq([...(diff.includes ?? []), ...plan.includes]);

  const out = await createArchiveDiff({
    cwd,
    stanPath,
    baseName: diff.baseName,
    includes,
    excludes: diff.excludes,
    updateSnapshot: diff.updateSnapshot,
    includeOutputDirInDiff: diff.includeOutputDirInDiff,
    onArchiveWarnings: diff.onArchiveWarnings,
  });

  return { ...staged, diffPath: out.diffPath };
};

export type DependencyContextSelectionHint = {
  /** Repo-relative nodeId to seed from. */
  nodeId: string;
  /** Traversal depth; 0 includes only nodeId. */
  depth: number;
  /** Edge kinds to traverse. */
  edgeKinds: DependencyEdgeType[];
};

export type DependencyContextSummary = {
  selection: DependencyContextSelectionHint[];
  stageNodeIds: string[];
};

export const summarizeDependencyContextPlan = (
  plan: PrepareDependencyContextResult,
): DependencyContextSummary => {
  // This is a best-effort summary for callers who want to surface plan info;
  // the engine itself remains silent.
  return {
    selection: [],
    stageNodeIds: [...plan.stageNodeIds],
  };
};

export default {
  prepareDependencyContext,
  stagePreparedDependencyContext,
  createArchiveWithDependencyContext,
  createArchiveDiffWithDependencyContext,
  summarizeDependencyContextPlan,
};
