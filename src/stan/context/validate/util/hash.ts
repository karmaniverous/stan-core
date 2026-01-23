/**
 * Hash helpers for dependency selection validation; filesystem IO only via
 * hashing a target file; no console output.
 * @module
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const sha256Hex = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

export const sha256FileAbs = async (
  abs: string,
): Promise<{ hash: string; size: number }> => {
  const buf = await readFile(abs);
  return { hash: sha256Hex(buf), size: buf.length };
};

export default { sha256Hex, sha256FileAbs };
