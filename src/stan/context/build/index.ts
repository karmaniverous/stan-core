/**
 * Public API for building dependency meta (graph generation + normalization).
 * @module
 */
import { generateRawGraph } from './graph';
import { normalizeGraph } from './normalize';
import type {
  BuildDependencyMetaArgs,
  BuildDependencyMetaResult,
} from './types';

export type { BuildDependencyMetaArgs, BuildDependencyMetaResult };
export type { NodeSource } from './types';

export const buildDependencyMeta = async (
  args: BuildDependencyMetaArgs,
): Promise<BuildDependencyMetaResult> => {
  const raw = await generateRawGraph(args);
  return normalizeGraph(args.cwd, args.stanPath, raw);
};
