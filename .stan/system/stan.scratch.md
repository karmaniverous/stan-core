# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- TypeDoc is clean again (`typedoc --emit none` has 0 warnings).
- Next: stan-cli wiring to consume `onSelectionReport` and present it (presentation only; no engine output files).
- Coordination: posted an interop note to stan-cli requesting selection report wiring.

## Working model (high signal)

- Selection reports are deterministic, small, data-only callbacks intended for CLI presentation (no engine I/O).
- Detailed file lists remain via `onArchiveWarnings`; selection reports should remain counts/options/flags only.

## Open questions

- Whether stan-cli should persist any selection report artifacts under `.stan/output/` (recommendation: no; present-only).
- Whether the report schema needs an opt-in “verbose” mode (recommendation: keep minimal; warnings already carry file lists).