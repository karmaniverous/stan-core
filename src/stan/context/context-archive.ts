/**
 * Orchestrates context-mode allowlist-only archiving (Base + dependency closure)
 * by staging selected external node bytes under <stanPath>/context/** and then
 * creating full/diff archives from the computed allowlist; filesystem IO only;
 * no console output.
 * @module
 */

import type { CreateArchiveFromFilesOptions } from '@/stan/archive/allowlist';
import { createArchiveFromFiles } from '@/stan/archive/allowlist';
import type { SnapshotUpdateMode } from '@/stan/diff/allowlist';
import { createArchiveDiffFromFiles } from '@/stan/diff/allowlist';

import type { ContextModeSelection } from './allowlist';
import { computeContextAllowlistPlan } from './allowlist';
import type { NodeSource } from './build';
import type { DependencyMetaFile } from './schema';
import type { StageDependencyContextResult } from './stage';
import { stageDependencyContext } from './stage';

export type CreateContextArchiveOptions = Pick<
  CreateArchiveFromFilesOptions,
  'fileName' | 'onArchiveWarnings'
> & {
  /** Context mode should remain allowlist-only; output dir inclusion is rarely desired. */
  includeOutputDir?: false;
};

export type CreateContextArchiveResult = {
  archivePath: string;
  plan: Awaited<ReturnType<typeof computeContextAllowlistPlan>>;
  stage: StageDependencyContextResult;
};

export const createContextArchiveWithDependencyContext = async (args: {
  cwd: string;
  stanPath: string;
  dependency: {
    meta: Pick<DependencyMetaFile, 'nodes' | 'edges'>;
    state?: unknown;
    sources?: Record<string, NodeSource>;
    clean?: boolean;
  };
  selection?: ContextModeSelection;
  archive?: CreateContextArchiveOptions;
}): Promise<CreateContextArchiveResult> => {
  const { cwd, stanPath, dependency, selection, archive } = args;

  const plan = await computeContextAllowlistPlan({
    cwd,
    stanPath,
    meta: dependency.meta,
    state: dependency.state,
    selection,
  });

  const stage = await stageDependencyContext({
    cwd,
    stanPath,
    meta: { nodes: dependency.meta.nodes },
    sources: dependency.sources,
    nodeIds: plan.stageNodeIds,
    clean: dependency.clean ?? false,
  });

  const archivePath = await createArchiveFromFiles(
    cwd,
    stanPath,
    plan.allowlistFiles,
    {
      includeOutputDir: false,
      fileName: archive?.fileName,
      onArchiveWarnings: archive?.onArchiveWarnings,
    },
  );

  return { archivePath, plan, stage };
};

export type CreateContextArchiveDiffResult = {
  diffPath: string;
  plan: Awaited<ReturnType<typeof computeContextAllowlistPlan>>;
  stage: StageDependencyContextResult;
};

export const createContextArchiveDiffWithDependencyContext = async (args: {
  cwd: string;
  stanPath: string;
  dependency: {
    meta: Pick<DependencyMetaFile, 'nodes' | 'edges'>;
    state?: unknown;
    sources?: Record<string, NodeSource>;
    clean?: boolean;
  };
  selection?: ContextModeSelection;
  diff: {
    baseName: string;
    updateSnapshot?: SnapshotUpdateMode;
    includeOutputDirInDiff?: boolean;
    onArchiveWarnings?: (text: string) => void;
  };
}): Promise<CreateContextArchiveDiffResult> => {
  const { cwd, stanPath, dependency, selection, diff } = args;

  const plan = await computeContextAllowlistPlan({
    cwd,
    stanPath,
    meta: dependency.meta,
    state: dependency.state,
    selection,
  });

  const stage = await stageDependencyContext({
    cwd,
    stanPath,
    meta: { nodes: dependency.meta.nodes },
    sources: dependency.sources,
    nodeIds: plan.stageNodeIds,
    clean: dependency.clean ?? false,
  });

  const out = await createArchiveDiffFromFiles({
    cwd,
    stanPath,
    baseName: diff.baseName,
    relFiles: plan.allowlistFiles,
    updateSnapshot: diff.updateSnapshot,
    includeOutputDirInDiff: diff.includeOutputDirInDiff,
    onArchiveWarnings: diff.onArchiveWarnings,
  });

  return { diffPath: out.diffPath, plan, stage };
};

export default {
  createContextArchiveWithDependencyContext,
  createContextArchiveDiffWithDependencyContext,
};
