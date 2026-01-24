/**
 * Dynamic loader and invoker for \@karmaniverous/stan-context.
 * @module
 */
import { loadStanContext } from '../deps';
import type { BuildDependencyMetaArgs, RawResult } from './types';

/**
 * Load dependencies and generate the raw dependency graph.
 * Throws if stan-context cannot be imported or if stan-context rejects inputs
 * (for example, when the host did not inject TypeScript as required).
 */
export const generateRawGraph = async (
  args: BuildDependencyMetaArgs,
): Promise<RawResult> => {
  const {
    cwd,
    selection,
    nodeDescriptionLimit,
    nodeDescriptionTags,
    maxErrors,
    typescript,
    typescriptPath,
  } = args;

  const mod = await loadStanContext().catch(() => {
    throw new Error(
      'dependency graph mode requires @karmaniverous/stan-context; install it alongside stan-core (stan-cli includes it)',
    );
  });

  const opts: Record<string, unknown> = {
    cwd,
    config: selection ?? {},
    nodeDescriptionLimit,
    nodeDescriptionTags,
    maxErrors,
  };
  if (typeof typescript !== 'undefined') opts.typescript = typescript;
  if (typeof typescriptPath === 'string' && typescriptPath.trim().length > 0) {
    opts.typescriptPath = typescriptPath.trim();
  }

  return (await mod.generateDependencyGraph(opts)) as RawResult;
};
