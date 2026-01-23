# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Selection report callbacks are implemented in stan-core archive APIs (data-only callback; no engine I/O).
- Follow-up fix: tests now capture selection reports without TS control-flow narrowing issues.
- Follow-up fix: diff test now narrows `SelectionReport` to `kind: 'diff'` before reading `snapshotExists`.
- Next step is stan-cli wiring: consume `onSelectionReport` and present it (no engine output files).

## Working model (high signal)

- Context-mode allowlist selection is computed as: Base (system docs + dependency meta/state + repo-root base files) + dependency-state closure nodeIds, with explicit excludes as hard denials and reserved denials always enforced.
- Context-mode archiving should not rely on the default denylist-driven selection; it should archive only from an explicit allowlist of repo-relative paths.
- Engine now has internal building blocks for context mode:
  - allowlist full archive creation (`createArchiveFromFiles`)
  - allowlist diff archive creation + snapshot handling (`createArchiveDiffFromFiles`)
  - allowlist planning (`computeContextAllowlistPlan`)
  - context-mode orchestration (`createContextArchiveWithDependencyContext`, `createContextArchiveDiffWithDependencyContext`)
- Budgeting helper present: `summarizeContextAllowlistBudget(...)` (uses meta sizes when present; stat fallback; deterministic `bytes/4` heuristic).
- TypeDoc warnings were cleared by aligning args-style TSDoc and exporting referenced option types in the public surface.
- Selection report (stan-core contract; CLI-facing diagnostic) is now implemented as `onSelectionReport?: (report: SelectionReport) => void` on archive APIs.
- Report is deterministic and small (counts/options/snapshot + classifier summary only; no full path lists).

## Open questions

- Whether stan-cli should persist any selection report artifacts under `.stan/output/` (recommendation: no; present-only).
- Whether the report schema needs an opt-in “verbose” mode (recommendation: keep minimal; warnings already carry file lists).