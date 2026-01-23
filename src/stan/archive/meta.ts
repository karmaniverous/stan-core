/**
 * Creates a minimal "meta" archive (system + dependency meta only) intended as
 * a thread opener for dependency graph mode; performs filesystem IO; no console
 * output.
 * @module
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ARCHIVE_META_TAR } from '@/stan/archive/constants';
import { makeTarFilter } from '@/stan/archive/util';
import { ensureOutAndDiff, filterFiles, listFiles } from '@/stan/fs';

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
  selection?: { includes?: string[]; excludes?: string[] },
): Promise<string> {
  const { outDir } = await ensureOutAndDiff(cwd, stanPath);

  const stanRel = stanPath.replace(/\\/g, '/');
  const systemPrefix = `${stanRel}/system/`;
  const docsMetaRel = `${stanRel}/system/.docs.meta.json`;
  const depMetaRel = `${stanRel}/context/dependency.meta.json`;
  const depStateRel = `${stanRel}/context/dependency.state.json`;

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

  // Repo-root base files (config-driven selection, restricted to repo root only).
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: selection?.includes ?? [],
    excludes: selection?.excludes ?? [],
  });
  const repoRootBaseFiles = filtered.filter((p) => !p.includes('/'));

  // Include dependency state when present (assistant-authored selection intent).
  const hasState =
    all.includes(depStateRel) && existsSync(resolve(cwd, depStateRel));

  const files = Array.from(
    new Set<string>([
      ...sys,
      depMetaRel,
      ...(hasState ? [depStateRel] : []),
      ...repoRootBaseFiles,
    ]),
  ).sort((a, b) => a.localeCompare(b));

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
