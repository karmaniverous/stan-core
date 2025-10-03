/**
 * Barrel exports for the stan engine.
 */
export * from './archive';
export * from './config/index';
export * from './diff';
export * from './validate/response';
// Patch engine (diff pipeline, file-ops, cleaners)
export * from './patch';
// Imports staging (label → staged files under <stanPath>/imports)
export { prepareImports } from './imports/stage';
// Prompt helpers (packaged path, dev assembly)
export { getPackagedSystemPromptPath } from './module';
export { assembleSystemMonolith } from './system/assemble';
export { CORE_VERSION } from './version';
