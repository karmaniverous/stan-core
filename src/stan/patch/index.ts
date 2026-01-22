/**
 * Public API surface for patch application and File Ops parsing/execution;
 * re-exports patch pipeline and helpers; no CLI/TTY concerns.
 * @module
 */
export { detectAndCleanPatch } from './clean';
export type { FileOp } from './file-ops';
export { executeFileOps, parseFileOpsBlock } from './file-ops';
export { applyPatchPipeline } from './run/pipeline';
// Low-level jsdiff apply (optional export)
export { applyWithJsDiff } from './jsdiff';
// Public type re-exports for documentation/discovery
export type { ApplyResult } from './apply';
export type { AttemptCapture } from './apply';
export type { FileOpsPlan, OpResult } from './file-ops';
export type { JsDiffOutcome } from './jsdiff';
export type { PipelineOutcome } from './run/pipeline';
