# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Fix TypeDoc warning: `SelectionReportCounts` is referenced by `SelectionReport` but not included in docs output.
- After docs are clean again: stan-cli wiring to consume `onSelectionReport` and present it (presentation only; no engine output files).

## Working model (high signal)

- `SelectionReportCounts` exists in `src/stan/archive/report.ts`, but must be re-exported from `src/stan/index.ts` so TypeDoc includes it when it is referenced by `SelectionReport`.

## Open questions

- Whether stan-cli should persist any selection report artifacts under `.stan/output/` (recommendation: no; present-only).
- Whether the report schema needs an opt-in “verbose” mode (recommendation: keep minimal; warnings already carry file lists).