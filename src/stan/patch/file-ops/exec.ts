/**
 * Executes File Ops (mv/cp/rm/rmdir/mkdirp) with safety checks.
 * @module
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  copy as copyAsync,
  ensureDir,
  move as moveAsync,
  pathExists,
  remove,
} from 'fs-extra';

import { resolveWithin as resolveWithinRepo } from '@/stan/path/repo';

import { isProtectedImportsPath } from '../policy/imports';
import type { FileOp, OpResult } from './types';

/** Execute File Ops with safety checks. Returns per-op results and overall ok. */
export const executeFileOps = async (
  cwd: string,
  ops: FileOp[],
  dryRun = false,
  stanPath?: string,
): Promise<{ ok: boolean; results: OpResult[] }> => {
  const results: OpResult[] = [];

  const within = (rel: string) => resolveWithinRepo(cwd, rel);
  const sp = stanPath?.trim().length ? stanPath.trim() : null;
  const guard = (rel: string): void => {
    if (sp && isProtectedImportsPath(sp, rel)) {
      throw new Error('path targets protected imports area');
    }
  };

  for (const op of ops) {
    const res: OpResult = {
      verb: op.verb,
      status: 'ok',
    };
    try {
      const src = (op as { src: string }).src;
      guard(src);
      const { abs: srcAbs, ok: sOK } = within(src);
      if (!sOK) throw new Error('path escapes repo root');

      if (op.verb === 'mv' || op.verb === 'cp') {
        const dest = op.dest;
        guard(dest);
        const { abs: dstAbs, ok: dOK } = within(dest);
        if (!dOK) throw new Error('path escapes repo root');

        const srcExists = await pathExists(srcAbs);
        const dstExists = await pathExists(dstAbs);
        if (!srcExists) throw new Error('source does not exist');
        if (dstExists) throw new Error('destination exists (no overwrite)');

        if (!dryRun) {
          await ensureDir(path.dirname(dstAbs));
          if (op.verb === 'mv') {
            await moveAsync(srcAbs, dstAbs, { overwrite: false });
          } else {
            await copyAsync(srcAbs, dstAbs, {
              overwrite: false,
              errorOnExist: true,
            });
          }
        }
      } else if (op.verb === 'rm') {
        if (!(await pathExists(srcAbs))) throw new Error('path does not exist');
        if (!dryRun) await remove(srcAbs);
      } else if (op.verb === 'rmdir') {
        let st: import('fs').Stats | null = null;
        try {
          st = await stat(srcAbs);
        } catch {
          st = null;
        }
        if (!st) throw new Error('directory does not exist');
        if (!st.isDirectory()) throw new Error('not a directory');
        const entries = await readdir(srcAbs);
        if (entries.length > 0) throw new Error('directory not empty');
        if (!dryRun) await remove(srcAbs);
      } else {
        if (!dryRun) await ensureDir(srcAbs);
      }
    } catch (e) {
      res.status = 'failed';
      res.message = e instanceof Error ? e.message : String(e);
    }
    results.push(res);
    if (res.status === 'failed' && !dryRun) break;
  }

  const ok = results.every((r) => r.status === 'ok');
  return { ok, results };
};

export const writeOpsDebugLog = async (
  cwd: string,
  stanPath: string,
  results: OpResult[],
): Promise<void> => {
  try {
    const debugDir = path.join(cwd, stanPath, 'patch', '.debug');
    await ensureDir(debugDir);
    const file = path.join(debugDir, 'ops.json');
    const body = JSON.stringify({ results }, null, 2);
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(file, body, 'utf8'),
    );
  } catch {
    // best-effort
  }
};
