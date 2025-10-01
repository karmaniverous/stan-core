/* src/stan/patch/index.ts
 * Public API surface for patch engine (no CLI/TTY concerns).
 */
export { detectAndCleanPatch } from './clean';
export type { FileOp } from './file-ops';
export { executeFileOps, parseFileOpsBlock } from './file-ops';
export { applyPatchPipeline } from './run/pipeline';
// Low-level jsdiff apply (optional export)
export { applyWithJsDiff } from './jsdiff';
