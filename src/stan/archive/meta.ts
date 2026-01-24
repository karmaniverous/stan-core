/**
 * Creates a "meta" archive (system docs + dependency meta, plus optional
 * dependency state and repo-root base files); excludes staged payloads by
 * omission and excludes `<stanPath>/system/.docs.meta.json`; filesystem IO only.
 * @module
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ARCHIVE_META_TAR } from '@/stan/archive/constants';
import type { SelectionReport } from '@/stan/archive/report';
import { surfaceSelectionReport } from '@/stan/archive/report';
import { makeTarFilter } from '@/stan/archive/util';
import { ensureOutAndDiff, filterFiles, listFiles } from '@/stan/fs';
import { uniqSortedStrings } from '@/stan/util/array/uniq';

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
  options?: {
    /** Optional callback for a deterministic selection report (engine remains silent by default). */
    onSelectionReport?: (report: SelectionReport) => void;
  },
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

  const files = uniqSortedStrings([
    ...sys,
    depMetaRel,
    ...(hasState ? [depStateRel] : []),
    ...repoRootBaseFiles,
  ]);

  const archivePath = resolve(outDir, ARCHIVE_META_TAR);
  surfaceSelectionReport(
    {
      kind: 'meta',
      mode: 'allowlist',
      stanPath,
      outputFile: archivePath,
      hasWarnings: false,
      counts: {
        candidates: all.length,
        selected: files.length,
        archived: files.length,
        excludedBinaries: 0,
        largeText: 0,
      },
    },
    options?.onSelectionReport,
  );

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
