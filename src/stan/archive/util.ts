/* src/stan/archive/util.ts
 * Shared helpers for archive/diff creation.
 */

import {
  isOutputArchivePath,
  isReservedWorkspacePath,
} from '@/stan/fs/reserved';

/**
 * Make a tar filter that excludes:
 * - <stanPath>/diff/**
 * - <stanPath>/output/archive.tar
 * - <stanPath>/output/archive.diff.tar
 * - <stanPath>/output/archive.warnings.txt
 * - <stanPath>/patch/**
 */
export const makeTarFilter = (stanPath: string) => {
  const base = stanPath.replace(/\\/g, '/');
  return (p: string): boolean =>
    !(isReservedWorkspacePath(base, p) || isOutputArchivePath(base, p));
};

/**
 * Compose the file list for tar creation when including the output directory.
 * Ensures <stanPath>/output is present once alongside the provided files.
 */
export const composeFilesWithOutput = (
  files: string[],
  stanPath: string,
): string[] => {
  const outDir = `${stanPath.replace(/\\/g, '/')}/output`;
  return Array.from(new Set<string>([...files, outDir]));
};

/** Surface archive classifier warnings via optional callback (engine remains silent). */
export const surfaceArchiveWarnings = (
  body: string | undefined,
  on?: (text: string) => void,
): void => {
  const trimmed = (body ?? '').trim();
  if (trimmed && trimmed !== 'No archive warnings.') on?.(trimmed);
};
