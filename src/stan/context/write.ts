/* src/stan/context/write.ts
 * Write dependency.meta.json deterministically under <stanPath>/context/.
 *
 * Requirements:
 * - Write to <stanPath>/context/dependency.meta.json with stable JSON formatting.
 * - Do not log; callers surface any warnings/errors.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureDir } from 'fs-extra';

import type { DependencyMetaFile } from './schema';

export const writeDependencyMetaFile = async (args: {
  cwd: string;
  stanPath: string;
  meta: DependencyMetaFile;
}): Promise<string> => {
  const { cwd, stanPath, meta } = args;
  const dir = path.join(cwd, stanPath, 'context');
  await ensureDir(dir);
  const abs = path.join(dir, 'dependency.meta.json');
  const body = JSON.stringify(meta, null, 2) + '\n';
  await writeFile(abs, body, 'utf8');
  return abs;
};

export default { writeDependencyMetaFile };
