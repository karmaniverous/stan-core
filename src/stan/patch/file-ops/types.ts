/**
 * Types for File Ops parsing and execution.
 * @module
 */

export type FileOp =
  | { verb: 'mv'; src: string; dest: string }
  | { verb: 'cp'; src: string; dest: string }
  | { verb: 'rm'; src: string }
  | { verb: 'rmdir'; src: string }
  | { verb: 'mkdirp'; src: string };

export type FileOpsPlan = { ops: FileOp[]; errors: string[] };

export type OpResult = {
  verb: FileOp['verb'];
  status: 'ok' | 'failed';
  message?: string;
};
