/**
 * Dynamic loader and invoker for \@karmaniverous/stan-context.
 * @module
 */
import { loadStanContext, loadTypeScript } from '../deps';
import type { BuildDependencyMetaArgs, RawResult } from './types';

/**
 * Load dependencies and generate the raw dependency graph.
 * Throws if TypeScript or stan-context is missing.
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
  } = args;

  try {
    await loadTypeScript();
  } catch {
    throw new Error(
      'dependency graph mode requires TypeScript; install "typescript" in this environment',
    );
  }

  const mod = await loadStanContext().catch(() => {
    throw new Error(
      'dependency graph mode requires @karmaniverous/stan-context; install it alongside stan-core (stan-cli includes it)',
    );
  });

  return (await mod.generateDependencyGraph({
    cwd,
    config: selection ?? {},
    nodeDescriptionLimit,
    nodeDescriptionTags,
    maxErrors,
  })) as RawResult;
};
