/* src/stan/archive/meta.ts
 * Create a "meta" archive intended as a small thread opener in dependency
 * graph mode:
 * - Includes all <stanPath>/system/** files, excluding <stanPath>/system/.docs.meta.json
 * - Includes <stanPath>/context/dependency.meta.json
 * - Excludes <stanPath>/context/dependency.state.json and staged payloads by omission
 *
 * This function is engine-only (no CLI/TTY). Callers decide when to invoke it.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ARCHIVE_META_TAR } from '@/stan/archive/constants';
import { makeTarFilter } from '@/stan/archive/util';
import { ensureOutAndDiff, listFiles } from '@/stan/fs';

type TarLike = {
  create: (
    opts: {
      file: string;
      cwd?: string;
      filter?: (path: string, stat: unknown) => boolean;
    },
    files: string[],
  ) => Promise<void>;
};

export async function createMetaArchive(
  cwd: string,
  stanPath: string,
): Promise<string> {
  const { outDir } = await ensureOutAndDiff(cwd, stanPath);

  const stanRel = stanPath.replace(/\\/g, '/');
  const systemPrefix = `${stanRel}/system/`;
  const docsMetaRel = `${stanRel}/system/.docs.meta.json`;
  const depMetaRel = `${stanRel}/context/dependency.meta.json`;

  const all = await listFiles(cwd);

  // Require dependency meta in dependency mode; meta archive is meaningless without it.
  if (!all.includes(depMetaRel) || !existsSync(resolve(cwd, depMetaRel))) {
    throw new Error(
      `dependency meta not found at ${depMetaRel}; ` +
        'generate dependency meta before creating archive.meta.tar',
    );
  }

  // Allowlist system files (minus .docs.meta.json)
  const sys = all
    .filter((p) => p.startsWith(systemPrefix))
    .filter((p) => p !== docsMetaRel);

  // Allowlist dependency meta only (exclude state + staged payloads by omission)
  const files = Array.from(new Set<string>([...sys, depMetaRel]));

  const archivePath = resolve(outDir, ARCHIVE_META_TAR);
  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create(
    {
      file: archivePath,
      cwd,
      filter: makeTarFilter(stanPath),
    },
    files,
  );
  return archivePath;
}

export default { createMetaArchive };
