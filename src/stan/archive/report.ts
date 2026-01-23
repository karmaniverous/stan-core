/**
 * Defines deterministic selection report types for archive/diff operations and
 * a safe surfacing helper; no filesystem IO; used by adapters for reporting.
 * @module
 */

/**
 * Selection counts for a single archive/diff/meta operation.
 *
 * Meanings:
 * - candidates: initial input set size for the operation (e.g. listFiles() size,
 *   or allowlist length as provided by the caller).
 * - selected: pre-classifier selected set size (e.g. after filterFiles(), or
 *   the de-duped allowlist).
 * - archived: post-classifier list size passed to tar.create().
 * - excludedBinaries: count excluded by classifier (binary detection).
 * - largeText: count flagged by classifier (included, but warned).
 */
export type SelectionReportCounts = {
  candidates: number;
  selected: number;
  archived: number;
  excludedBinaries: number;
  largeText: number;
};

/**
 * Deterministic, presentation-free selection report surfaced via callback.
 *
 * Notes:
 * - `outputFile` is an absolute path.
 * - `hasWarnings` is derived from classifier counts (binaries excluded and/or
 *   large text flagged), not from any warnings string.
 */
export type SelectionReport =
  | {
      kind: 'archive';
      mode: 'denylist' | 'allowlist';
      stanPath: string;
      outputFile: string;
      includeOutputDir: boolean;
      hasWarnings: boolean;
      counts: SelectionReportCounts;
    }
  | {
      kind: 'diff';
      mode: 'denylist' | 'allowlist';
      stanPath: string;
      outputFile: string;
      includeOutputDirInDiff: boolean;
      updateSnapshot: 'never' | 'createIfMissing' | 'replace';
      snapshotExists: boolean;
      /**
       * Size of the base selection set from which changes were computed
       * (e.g. filtered selection or allowlist after de-dupe).
       */
      baseSelected: number;
      sentinelUsed: boolean;
      hasWarnings: boolean;
      counts: SelectionReportCounts;
    }
  | {
      kind: 'meta';
      mode: 'allowlist';
      stanPath: string;
      outputFile: string;
      hasWarnings: false;
      counts: SelectionReportCounts;
    };

/**
 * Surface selection report via optional callback; swallows callback errors so
 * engine behavior remains deterministic and presentation-free.
 *
 * @param report - Deterministic selection report object.
 * @param on - Optional callback invoked with the report.
 */
export const surfaceSelectionReport = (
  report: SelectionReport,
  on?: (report: SelectionReport) => void,
): void => {
  if (typeof on !== 'function') return;
  try {
    on(report);
  } catch {
    // ignore callback errors
  }
};

export default { surfaceSelectionReport };
