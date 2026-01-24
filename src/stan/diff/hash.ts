/**
 * Computes deterministic sha256 hashes for repo-relative file lists; used by
 * snapshot/diff implementations.
 * @module
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Compute sha256 hashes for each file (keyed by repo-relative path).
 *
 * @param cwd - Repo root.
 * @param relFiles - Repo-relative file paths.
 * @returns Map from rel path to sha256 hex digest.
 */
export const computeFileHashes = async (
  cwd: string,
  relFiles: string[],
): Promise<Record<string, string>> => {
  const current: Record<string, string> = {};
  for (const rel of relFiles) {
    const abs = resolve(cwd, rel);
    const buf = await readFile(abs);
    current[rel] = createHash('sha256').update(buf).digest('hex');
  }
  return current;
};

export default { computeFileHashes };
