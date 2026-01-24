/**
 * Centralized constants for diff snapshot state and sentinel behavior; used by
 * denylist and allowlist diff implementations.
 * @module
 */

/** Snapshot file name stored under `<stanPath>/diff/`. */
export const ARCHIVE_SNAPSHOT_FILE = '.archive.snapshot.json';

/** Sentinel file name written when no changes exist (diff tar contains only this). */
export const NO_CHANGES_SENTINEL_FILE = '.stan_no_changes';

export default { ARCHIVE_SNAPSHOT_FILE, NO_CHANGES_SENTINEL_FILE };
