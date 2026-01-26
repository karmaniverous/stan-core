/**
 * Creates a "meta" archive (system docs + dependency meta, plus optional
 * repo-root base files); omits dependency state (clean slate); excludes staged
 * payloads by omission and excludes `<stanPath>/system/.docs.meta.json`;
 * filesystem IO only.
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
    /**
     * When true, include `<stanPath>/output/**` contents inside the meta archive
     * (combine mode). Known STAN archive files remain excluded by tar filter.
     */
    includeOutputDir?: boolean;
    /**
     * Output file name (default: `archive.meta.tar`).
     * Written to `<stanPath>/output/<fileName>`.
     */
    fileName?: string;
  },
): Promise<string> {
  const { outDir } = await ensureOutAndDiff(cwd, stanPath);
  const includeOutputDir = options?.includeOutputDir === true;

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

  // Repo-root base files (config-driven selection, restricted to repo root only).
  const filtered = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir: false,
    includes: selection?.includes ?? [],
    excludes: selection?.excludes ?? [],
  });
  const repoRootBaseFiles = filtered.filter((p) => !p.includes('/'));

  const files = uniqSortedStrings([
    ...sys,
    depMetaRel,
    ...repoRootBaseFiles,
    ...(includeOutputDir ? [`${stanRel}/output`] : []),
  ]);

  const archivePath = resolve(outDir, options?.fileName ?? ARCHIVE_META_TAR);
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
