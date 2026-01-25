/**
 * Writes dependency.meta.json under <stanPath>/context/; filesystem IO only;
 * deterministic JSON formatting; no console output.
 *
 * Write dependency.meta.json deterministically under <stanPath>/context/.
 *
 * Requirements:
 * - Write to <stanPath>/context/dependency.meta.json with stable JSON formatting.
 * - Do not log; callers surface any warnings/errors.
 * @module
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ensureDir } from 'fs-extra';

import type { DependencyMapFile, DependencyMetaFile } from './schema';

export const writeDependencyMetaFile = async (args: {
  cwd: string;
  stanPath: string;
  meta: DependencyMetaFile;
}): Promise<string> => {
  const { cwd, stanPath, meta } = args;
  const dir = path.join(cwd, stanPath, 'context');
  await ensureDir(dir);
  const abs = path.join(dir, 'dependency.meta.json');
  // V2 is minified by default
  const body = JSON.stringify(meta) + '\n';
  await writeFile(abs, body, 'utf8');
  return abs;
};

export const writeDependencyMapFile = async (args: {
  cwd: string;
  stanPath: string;
  map: DependencyMapFile;
}): Promise<string> => {
  const { cwd, stanPath, map } = args;
  const dir = path.join(cwd, stanPath, 'context');
  await ensureDir(dir);
  const abs = path.join(dir, 'dependency.map.json');
  // Map can be pretty for debugging, or minified. Let's pretty-print for now as it's host-private.
  const body = JSON.stringify(map, null, 2) + '\n';
  await writeFile(abs, body, 'utf8');
  return abs;
};

export default { writeDependencyMetaFile, writeDependencyMapFile };
