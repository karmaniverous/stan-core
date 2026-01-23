/**
 * Creates full archives (`archive.tar`) from selected repo files; excludes
 * binaries, surfaces warnings via callback, and maintains `archive.prev.tar`;
 * performs filesystem IO; no console output.
 * @module
 */

import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ARCHIVE_PREV_TAR } from './archive/constants';
import type { SelectionReport } from './archive/report';
import { surfaceSelectionReport } from './archive/report';
import {
  composeFilesWithOutput,
  makeTarFilter,
  surfaceArchiveWarnings,
} from './archive/util';
import { ensureOutAndDiff, filterFiles, listFiles } from './fs';

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

/** Options to control archive creation. */
export type CreateArchiveOptions = {
  /** When true, include the `stanPath/output` directory inside the archive. */
  includeOutputDir?: boolean;
  /**
   * Archive file name. If provided without `.tar`, the suffix is added.
   * Written to `stanPath/output/<fileName>`.
   */
  fileName?: string;
  /** Additive allow‑list globs (can re-include gitignored files); excludes and reserved denials still win. */
  includes?: string[];
  /**
   * Deny‑list globs (hard denials). These always apply and take precedence over
   * includes.
   */
  excludes?: string[];
  /** Optional callback for archive classifier warnings (engine remains silent by default). */
  onArchiveWarnings?: (text: string) => void;
  /** Optional callback for a deterministic selection report (engine remains silent by default). */
  onSelectionReport?: (report: SelectionReport) => void;
};

/**
 * SSR‑safe resolver for classifyForArchive (named‑or‑default).
 * Prefer the named export; fall back to default.classifyForArchive.
 */
const getClassifyForArchive = async (): Promise<
  (typeof import('./classifier'))['classifyForArchive']
> => {
  try {
    const mod = await import('./classifier');
    const named = (mod as { classifyForArchive?: unknown }).classifyForArchive;
    const viaDefault = (mod as { default?: { classifyForArchive?: unknown } })
      .default?.classifyForArchive;
    const fn = (typeof named === 'function' ? named : viaDefault) as
      | (typeof import('./classifier'))['classifyForArchive']
      | undefined;
    if (typeof fn === 'function') return fn;
  } catch {
    /* ignore */
  }
  throw new Error('classifyForArchive export not found in ./classifier');
};
/**
 * Create `stanPath/output/archive.tar` (or custom file name) from the repo root.
 *
 * @example
 * ```ts
 * const tarPath = await createArchive(process.cwd(), '.stan', {
 *   includeOutputDir: false,
 *   excludes: ['**\/.tsbuild/**'],
 *   includes: ['README.md', 'docs/index.md'], // re-include even if gitignored
 * });
 * ```
 */
export async function createArchive(
  cwd: string,
  stanPath: string,
  options: CreateArchiveOptions = {},
): Promise<string> {
  const {
    includeOutputDir = false,
    fileName: rawFileName,
    includes = [],
    excludes = [],
  } = options;

  let fileName = rawFileName ?? 'archive.tar';
  if (!fileName.endsWith('.tar')) fileName += '.tar';

  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const all = await listFiles(cwd);
  const files = await filterFiles(all, {
    cwd,
    stanPath,
    includeOutputDir,
    includes,
    excludes,
  });

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
  const classifyForArchive = await getClassifyForArchive();
  const { textFiles, excludedBinaries, largeText, warningsBody } =
    await classifyForArchive(cwd, files);
  const filesForArchive = textFiles;

  surfaceArchiveWarnings(warningsBody, options.onArchiveWarnings);

  surfaceSelectionReport(
    {
      kind: 'archive',
      mode: 'denylist',
      stanPath,
      outputFile: archivePath,
      includeOutputDir,
      hasWarnings: excludedBinaries.length > 0 || largeText.length > 0,
      counts: {
        candidates: all.length,
        selected: files.length,
        archived: filesForArchive.length,
        excludedBinaries: excludedBinaries.length,
        largeText: largeText.length,
      },
    },
    options.onSelectionReport,
  );

  const tar = (await import('tar')) as unknown as TarLike;

  if (includeOutputDir) {
    // Force-include <stanPath>/output and exclude <stanPath>/diff and archive files.
    await tar.create(
      {
        file: archivePath,
        cwd,
        filter: makeTarFilter(stanPath),
      },
      composeFilesWithOutput(filesForArchive, stanPath),
    );
  } else {
    // No refactors directory is created anymore; no special-case filter needed for it.
    await tar.create(
      {
        file: archivePath,
        cwd,
        filter: makeTarFilter(stanPath),
      },
      filesForArchive,
    );
  }
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
