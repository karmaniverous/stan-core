/**
 * Barrel exports for the STAN engine API; re-exports archive/diff/patch/config/
 * context helpers; no side effects beyond re-exports.
 * @module
 */
export * from './archive';
export type { CreateArchiveFromFilesOptions } from './archive/allowlist';
export { createMetaArchive } from './archive/meta';
export type { SelectionReport, SelectionReportCounts } from './archive/report';
export * from './config/index';
export * from './diff';
export {
  createArchiveDiffFromFiles,
  writeArchiveSnapshotFromFiles,
} from './diff/allowlist';
// Patch engine (diff pipeline, file-ops, cleaners)
export * from './patch';
// Imports staging (label → staged files under <stanPath>/imports)
export type { ImportsMap } from './imports/stage';
export { prepareImports } from './imports/stage';
// Dependency graph mode primitives (meta/state parsing + closure)
export * from './context';
// Prompt helpers (packaged path, dev assembly)
export { makeGlobMatcher } from './fs/match';
export { getPackagedSystemPromptPath } from './module';
export type { AssembleResult } from './system/assemble';
export { assembleSystemMonolith } from './system/assemble';
export { CORE_VERSION } from './version';
