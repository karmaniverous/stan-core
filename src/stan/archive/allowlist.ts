/**
 * Creates a full archive from an explicit allowlist of repo-relative files;
 * excludes binaries via classifier, maintains `archive.prev.tar`, and surfaces
 * warnings via callback; filesystem IO only; no console output.
 * @module
 */

import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ARCHIVE_PREV_TAR } from '@/stan/archive/constants';
import type { SelectionReport } from '@/stan/archive/report';
import { surfaceSelectionReport } from '@/stan/archive/report';
import {
  composeFilesWithOutput,
  makeTarFilter,
  surfaceArchiveWarnings,
} from '@/stan/archive/util';
import { ensureOutAndDiff } from '@/stan/fs';
import { uniqSortedStrings } from '@/stan/util/array/uniq';
import { functionGuard, resolveExport } from '@/stan/util/ssr/resolve-export';

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

export type CreateArchiveFromFilesOptions = {
  /** When true, include the `stanPath/output` directory inside the archive. */
  includeOutputDir?: boolean;
  /**
   * Archive file name. If provided without `.tar`, the suffix is added.
   * Written to `stanPath/output/<fileName>`.
   */
  fileName?: string;
  /** Optional callback for archive classifier warnings (engine remains silent by default). */
  onArchiveWarnings?: (text: string) => void;
  /** Optional callback for a deterministic selection report (engine remains silent by default). */
  onSelectionReport?: (report: SelectionReport) => void;
};

const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

/**
 * Create `stanPath/output/archive.tar` (or custom file name) from an explicit
 * allowlist of repo-relative paths.
 *
 * This is used by context mode, where archive selection must be allowlist-only
 * rather than the default denylist-driven selection.
 *
 * @param cwd - Repo root.
 * @param stanPath - STAN workspace folder.
 * @param relFiles - Repo-relative POSIX paths to include (files only).
 * @param options - See {@link CreateArchiveFromFilesOptions}.
 * @returns Absolute path to the created tar.
 */
export async function createArchiveFromFiles(
  cwd: string,
  stanPath: string,
  relFiles: string[],
  options: CreateArchiveFromFilesOptions = {},
): Promise<string> {
  const { includeOutputDir = false, fileName: rawFileName } = options;

  let fileName = rawFileName ?? 'archive.tar';
  if (!fileName.endsWith('.tar')) fileName += '.tar';

  const files = uniqSortedStrings(relFiles, toPosix);

  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const archivePath = resolve(outDir, fileName);
  const prevPath = resolve(diffDir, ARCHIVE_PREV_TAR);

  // If an old archive exists in output, copy it to diff before overwriting.
  if (existsSync(archivePath)) {
    try {
      await copyFile(archivePath, prevPath);
    } catch {
      // ignore copy errors
    }
  }

  // Classify prior to archiving:
  // - exclude binaries
  // - flag large text (not excluded)
  const classifyForArchive = await resolveExport(
    () => import('@/stan/classifier'),
    'classifyForArchive',
    functionGuard<(typeof import('@/stan/classifier'))['classifyForArchive']>(),
    { moduleLabel: '@/stan/classifier', acceptCallableDefault: true },
  );
  const { textFiles, excludedBinaries, largeText, warningsBody } =
    await classifyForArchive(cwd, files);
  surfaceArchiveWarnings(warningsBody, options.onArchiveWarnings);

  surfaceSelectionReport(
    {
      kind: 'archive',
      mode: 'allowlist',
      stanPath,
      outputFile: archivePath,
      includeOutputDir,
      hasWarnings: excludedBinaries.length > 0 || largeText.length > 0,
      counts: {
        candidates: relFiles.length,
        selected: files.length,
        archived: textFiles.length,
        excludedBinaries: excludedBinaries.length,
        largeText: largeText.length,
      },
    },
    options.onSelectionReport,
  );

  const tar = (await import('tar')) as unknown as TarLike;
  await tar.create(
    {
      file: archivePath,
      cwd,
      filter: makeTarFilter(stanPath),
    },
    includeOutputDir
      ? composeFilesWithOutput(textFiles, stanPath)
      : uniqSortedStrings(textFiles),
  );

  // Ensure prev exists on first run.
  if (!existsSync(prevPath)) {
    try {
      await copyFile(archivePath, prevPath);
    } catch {
      // ignore copy errors
    }
  }

  return archivePath;
}

export default { createArchiveFromFiles };
