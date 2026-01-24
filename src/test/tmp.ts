/* src/test/tmp.ts */
/**
 * Temp directory helpers for tests; centralized mkdtemp + robust cleanup to
 * reduce Windows/CI flake.
 * @module
 */
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { rmDirWithRetries } from './fs';

export const makeTempDir = async (prefix: string): Promise<string> => {
  return mkdtemp(path.join(os.tmpdir(), prefix));
};

export const cleanupTempDir = async (dir: string): Promise<void> => {
  // Avoid being inside a directory that is being removed (Windows safety).
  try {
    process.chdir(os.tmpdir());
  } catch {
    // ignore
  }
  await rmDirWithRetries(dir);
};

export default { makeTempDir, cleanupTempDir };
