/**
 * Creates diff archives from an explicit allowlist of repo-relative files and
 * manages snapshot state; excludes binaries via classifier; filesystem IO only;
 * no console output.
 * @module
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { SelectionReport } from '@/stan/archive/report';
import { surfaceSelectionReport } from '@/stan/archive/report';
import {
  composeFilesWithOutput,
  makeTarFilter,
  surfaceArchiveWarnings,
} from '@/stan/archive/util';
import type { SnapshotUpdateMode } from '@/stan/diff';
import {
  ARCHIVE_SNAPSHOT_FILE,
  NO_CHANGES_SENTINEL_FILE,
} from '@/stan/diff/constants';
import { computeFileHashes } from '@/stan/diff/hash';
import { ensureOutAndDiff } from '@/stan/fs';
import { functionGuard, resolveExport } from '@/stan/util/ssr/resolve-export';

export type { SnapshotUpdateMode };

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

const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

const uniqSorted = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((s) => toPosix(s).trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );

const snapshotPathFor = (diffDir: string): string =>
  join(diffDir, ARCHIVE_SNAPSHOT_FILE);

const sentinelPathFor = (diffDir: string): string =>
  join(diffDir, NO_CHANGES_SENTINEL_FILE);

/**
 * SSR-safe resolver for `classifyForArchive` (named-or-default).
 * Prefer the named export; fall back to default.classifyForArchive.
 */
const getClassifyForArchive = async (): Promise<
  (typeof import('@/stan/classifier'))['classifyForArchive']
> => {
  return resolveExport(
    () => import('@/stan/classifier'),
    'classifyForArchive',
    functionGuard<(typeof import('@/stan/classifier'))['classifyForArchive']>(),
    { moduleLabel: '@/stan/classifier', acceptCallableDefault: true },
  );
};

/**
 * Create a diff tar at <stanPath>/output/<baseName>.diff.tar from an explicit
 * allowlist of repo-relative files.
 *
 * Snapshot semantics:
 * - Snapshot path: <stanPath>/diff/.archive.snapshot.json
 * - When snapshot exists: include only changed files (within allowlist).
 * - When snapshot missing: include full allowlist (diff equals full selection).
 * - No-changes case: write <stanPath>/diff/.stan_no_changes and include it.
 */
export async function createArchiveDiffFromFiles(args: {
  cwd: string;
  stanPath: string;
  baseName: string;
  relFiles: string[];
  updateSnapshot?: SnapshotUpdateMode;
  includeOutputDirInDiff?: boolean;
  onArchiveWarnings?: (text: string) => void;
  onSelectionReport?: (report: SelectionReport) => void;
}): Promise<{ diffPath: string }> {
  const {
    cwd,
    stanPath,
    baseName,
    relFiles,
    updateSnapshot = 'createIfMissing',
    includeOutputDirInDiff = false,
    onArchiveWarnings,
    onSelectionReport,
  } = args;

  const files = uniqSorted(relFiles);

  const { outDir, diffDir } = await ensureOutAndDiff(cwd, stanPath);

  const current = await computeFileHashes(cwd, files);

  const snapPath = snapshotPathFor(diffDir);
  const hasPrev = existsSync(snapPath);
  const prev: Record<string, string> = hasPrev
    ? (JSON.parse(await readFile(snapPath, 'utf8')) as Record<string, string>)
    : {};

  const changedRaw: string[] = hasPrev
    ? files.filter((rel) => !prev[rel] || prev[rel] !== current[rel])
    : [...files];

  // Classify like the regular archive:
  // - exclude binaries
  // - flag large text (not excluded)
  const classifyForArchive = await getClassifyForArchive();
  const { textFiles, excludedBinaries, largeText, warningsBody } =
    await classifyForArchive(cwd, changedRaw);
  const changed = uniqSorted(textFiles);

  surfaceArchiveWarnings(warningsBody, onArchiveWarnings);

  const diffPath = join(outDir, `${baseName}.diff.tar`);
  const tar = (await import('tar')) as unknown as TarLike;

  const sentinelUsed = !includeOutputDirInDiff && changed.length === 0;
  surfaceSelectionReport(
    {
      kind: 'diff',
      mode: 'allowlist',
      stanPath,
      outputFile: diffPath,
      includeOutputDirInDiff,
      updateSnapshot,
      snapshotExists: hasPrev,
      baseSelected: files.length,
      sentinelUsed,
      hasWarnings: excludedBinaries.length > 0 || largeText.length > 0,
      counts: {
        candidates: relFiles.length,
        selected: changedRaw.length,
        archived: changed.length,
        excludedBinaries: excludedBinaries.length,
        largeText: largeText.length,
      },
    },
    onSelectionReport,
  );

  if (includeOutputDirInDiff) {
    await tar.create(
      {
        file: diffPath,
        cwd,
        filter: makeTarFilter(stanPath),
      },
      composeFilesWithOutput(changed, stanPath),
    );
  } else if (changed.length === 0) {
    const sentinel = sentinelPathFor(diffDir);
    await writeFile(sentinel, 'no changes', 'utf8');
    const only = `${toPosix(stanPath)}/diff/${NO_CHANGES_SENTINEL_FILE}`;
    await tar.create({ file: diffPath, cwd }, [only]);
  } else {
    await tar.create({ file: diffPath, cwd }, changed);
  }

  if (updateSnapshot === 'replace') {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  } else if (updateSnapshot === 'createIfMissing' && !hasPrev) {
    await writeFile(snapPath, JSON.stringify(current, null, 2), 'utf8');
  }

  return { diffPath };
}

export default { createArchiveDiffFromFiles };
