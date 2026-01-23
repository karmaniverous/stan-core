/**
 * Barrel exports for dependency graph mode primitives; re-exports types and
 * helpers; no side effects beyond re-exports.
 * @module
 */

export type { ContextAllowlistPlan, ContextModeSelection } from './allowlist';
export { computeContextAllowlistPlan } from './allowlist';
export type {
  CreateArchiveDiffWithDependencyContextResult,
  CreateArchiveWithDependencyContextResult,
  DependencyContextInputs,
  DependencyContextMeta,
  PrepareDependencyContextResult,
  StagePreparedDependencyContextResult,
} from './archive-flow';
export {
  createArchiveDiffWithDependencyContext,
  createArchiveWithDependencyContext,
  prepareDependencyContext,
  stagePreparedDependencyContext,
} from './archive-flow';
export type {
  BudgetEntry,
  BudgetSource,
  ContextAllowlistBudget,
} from './budget';
export { summarizeContextAllowlistBudget } from './budget';
export type {
  BuildDependencyMetaArgs,
  BuildDependencyMetaResult,
} from './build';
export type { NodeSource } from './build';
export { buildDependencyMeta } from './build';
export type {
  CreateContextArchiveDiffResult,
  CreateContextArchiveResult,
} from './context-archive';
export {
  createContextArchiveDiffWithDependencyContext,
  createContextArchiveWithDependencyContext,
} from './context-archive';
export type {
  DependencyEdgeType,
  DependencyMetaEdge,
  DependencyMetaFile,
  DependencyMetaNode,
  DependencyStateEntry,
  DependencyStateFile,
  NormalizedDependencyStateEntry,
} from './schema';
export {
  dependencyEdgeTypeSchema,
  dependencyMetaEdgeSchema,
  dependencyMetaFileSchema,
  dependencyMetaNodeSchema,
  dependencyStateEntrySchema,
  dependencyStateFileSchema,
  parseDependencyStateFile,
} from './schema';
export type {
  StagedEntry,
  StageDependencyContextArgs,
  StageDependencyContextResult,
} from './stage';
export { stageDependencyContext } from './stage';
export { computeSelectedNodeIds, expandEntry } from './state';
export type {
  DependencyValidationMismatch,
  ValidateDependencySelectionResult,
} from './validate';
export { validateDependencySelection } from './validate';
export { validateDependencySelectionOrThrow } from './validate';
export { writeDependencyMetaFile } from './write';
