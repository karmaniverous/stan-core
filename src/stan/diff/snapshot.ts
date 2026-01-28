/**
 * Resolves diff snapshot file paths and validates snapshot file names; pure
 * path helpers; no filesystem IO.
 * @module
 */

import { join } from 'node:path';

import { ARCHIVE_SNAPSHOT_FILE } from './constants';

const HAS_SLASH_RE = /[\\/]/;

/**
 * Normalize a snapshot file name used under `<stanPath>/diff/`.
 *
 * @param raw - Optional caller-supplied snapshot file name.
 * @returns Safe file name (defaults to {@link ARCHIVE_SNAPSHOT_FILE}).
 * @throws When the name is not a simple file name (contains slashes or `..`).
 */
export const normalizeSnapshotFileName = (raw?: string): string => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return ARCHIVE_SNAPSHOT_FILE;
  }

  const name = raw.trim();
  if (HAS_SLASH_RE.test(name) || name.includes('..')) {
    throw new Error(
      `invalid snapshotFileName "${name}" (must be a simple file name; no slashes or "..")`,
    );
  }
  return name;
};

/**
 * Resolve the absolute snapshot path for a given diff directory.
 *
 * @param diffDir - Absolute `<stanPath>/diff` directory.
 * @param snapshotFileName - Optional snapshot file name override.
 * @returns Absolute snapshot path.
 */
export const snapshotPathFor = (
  diffDir: string,
  snapshotFileName?: string,
): string => {
  return join(diffDir, normalizeSnapshotFileName(snapshotFileName));
};

export default { normalizeSnapshotFileName, snapshotPathFor };
