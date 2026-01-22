/**
 * Public API barrel for config discovery/loading and workspace initialization;
 * no side effects beyond re-exports.
 * @module
 */
export { DEFAULT_OPEN_COMMAND, DEFAULT_STAN_PATH } from './defaults';
export { findConfigPathSync } from './discover';
export {
  loadConfig,
  loadConfigSync,
  resolveStanPath,
  resolveStanPathSync,
} from './load';
export { ensureOutputDir } from './output';
export type { ContextConfig } from './types';
