/**
 * Centralized archive naming constants (full/diff/meta/prev); pure values used
 * across archiving flows.
 * @module
 */
export const ARCHIVE_BASENAME = 'archive';
export const ARCHIVE_TAR = 'archive.tar';
export const ARCHIVE_DIFF_TAR = 'archive.diff.tar';
export const ARCHIVE_META_TAR = 'archive.meta.tar';
export const ARCHIVE_PREV_TAR = 'archive.prev.tar';
// retained for safety (excluded from filter); no file is written anymore
export const ARCHIVE_WARNINGS = 'archive.warnings.txt';
