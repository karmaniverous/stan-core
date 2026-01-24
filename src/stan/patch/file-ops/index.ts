/**
 * File Ops public API (types, parse, exec, debug log).
 * @module
 */
export { executeFileOps, writeOpsDebugLog } from './exec';
export { parseFileOpsBlock } from './parse';
export type { FileOp, FileOpsPlan, OpResult } from './types';
