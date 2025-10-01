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

/** Log archive classifier warnings consistently (no file output). */
export const logArchiveWarnings = (warningsBody: string): void => {
  const trimmed = (warningsBody ?? '').trim();
  if (trimmed && trimmed !== 'No archive warnings.') {
    // Single, concise section; colorless in core
    console.log(`stan: archive warnings\n${trimmed}`);
  }
};
