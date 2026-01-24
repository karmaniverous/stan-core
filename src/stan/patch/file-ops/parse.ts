/**
 * Parses "### File Ops" blocks into structured operations.
 * @module
 */
import { normalizeRepoPath } from '@/stan/path/repo';

import { extractFileOpsBody } from '../common/file-ops';
import { isProtectedImportsPath } from '../policy/imports';
import type { FileOp, FileOpsPlan } from './types';

/** Parse the optional "### File Ops" fenced block from a reply body. */
export const parseFileOpsBlock = (
  source: string,
  stanPath?: string,
): FileOpsPlan => {
  const ops: FileOp[] = [];
  const errors: string[] = [];
  const body = extractFileOpsBody(source);
  if (!body) return { ops, errors };

  const sp = stanPath?.trim().length ? stanPath.trim() : null;
  const lines = body.split(/\r?\n/);

  let lineNo = 0;
  for (const raw of lines) {
    lineNo += 1;
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const verbRaw = parts[0];
    const args = parts.slice(1);
    const bad = (msg: string) =>
      errors.push(`file-ops line ${lineNo.toString()}: ${msg}`);

    const normSafe = (p?: string) => normalizeRepoPath(p);
    const rejectIfProtected = (verb: string, p: string): boolean => {
      if (!sp || !isProtectedImportsPath(sp, p)) return false;
      bad(`${verb}: path targets protected imports area`);
      return true;
    };

    const checkArity = (n: number) => {
      if (args.length !== n) {
        bad(`expected ${n.toString()} paths, got ${args.length.toString()}`);
        return false;
      }
      return true;
    };

    if (verbRaw === 'mv' || verbRaw === 'cp') {
      if (!checkArity(2)) continue;
      const src = normSafe(args[0]);
      const dest = normSafe(args[1]);
      if (!src || !dest) {
        bad(`${verbRaw}: invalid repo-relative path`);
        continue;
      }
      if (rejectIfProtected(verbRaw, src) || rejectIfProtected(verbRaw, dest))
        continue;
      ops.push({ verb: verbRaw, src, dest });
    } else if (
      verbRaw === 'rm' ||
      verbRaw === 'rmdir' ||
      verbRaw === 'mkdirp'
    ) {
      if (!checkArity(1)) continue;
      const src = normSafe(args[0]);
      if (!src) {
        bad(`${verbRaw}: invalid repo-relative path`);
        continue;
      }
      if (rejectIfProtected(verbRaw, src)) continue;
      ops.push({ verb: verbRaw, src });
    } else {
      bad(`unknown verb "${verbRaw}"`);
    }
  }
  return { ops, errors };
};
