# stan-cli wiring: onSelectionReport (selection summary)

- Context: stan-core now exposes a data-only selection report callback on archive/diff/meta creation paths (`onSelectionReport?: (report: SelectionReport) => void`).
- Status: TypeDoc is clean again; `SelectionReportCounts` is now re-exported from the public surface (`src/stan/index.ts`) so `typedoc --emit none` reports 0 warnings.

## Request

- Please wire stan-cli to pass `onSelectionReport` when calling stan-core archiving APIs (run/snap/context flows as applicable) and present a concise summary to the user (TTY/non-TTY is CLI-owned).
- Suggestion: one line per operation (archive/diff/meta) showing key counts and flags (e.g., kind/mode, candidates/selected/archived, excludedBinaries/largeText, snapshotExists/sentinelUsed for diff).
- Engine contract reminder: no engine output files; presentation only. Detailed file lists remain via `onArchiveWarnings` (already supported).

## Notes

- Types are `SelectionReport` and `SelectionReportCounts` exported from `@karmaniverous/stan-core`.
