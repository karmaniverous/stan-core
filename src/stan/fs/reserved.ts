/**
 * Defines reserved workspace path rules (diff/patch/output archives); pure
 * helpers; no filesystem IO; used by selection and tar filtering.
 * @module
 */
import {
  ARCHIVE_DIFF_TAR,
  ARCHIVE_TAR,
  ARCHIVE_WARNINGS,
} from '@/stan/archive/constants';
import { isUnder } from '@/stan/path/prefix';
import { toPosix } from '@/stan/path/repo';

const DEPENDENCY_MAP_FILE = 'dependency.map.json';

/** Reserved workspace subpaths never included in archives by policy. */
export const isReservedWorkspacePath = (
  stanPath: string,
  p: string,
): boolean => {
  // isUnder normalizes, so we can pass stanPath directly or pre-join
  const base = toPosix(stanPath);
  const rel = toPosix(p);
  return (
    isUnder(`${base}/diff`, rel) ||
    isUnder(`${base}/patch`, rel) ||
    // Host-private dependency map must never be archived.
    rel === `${base}/context/${DEPENDENCY_MAP_FILE}`
  );
};

/** Reserved archive file names under <stanPath>/output. */
export const isOutputArchivePath = (stanPath: string, p: string): boolean => {
  const base = toPosix(stanPath);
  const rel = toPosix(p);
  return (
    rel === `${base}/output/${ARCHIVE_TAR}` ||
    rel === `${base}/output/${ARCHIVE_DIFF_TAR}` ||
    rel === `${base}/output/${ARCHIVE_WARNINGS}`
  );
};

// re-export utility for callers that need a prefix check
export { isUnder };
