# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Implement `--context` allowlist-only archiving (Base + dependency closure) and wire it into the CLI flow.
- Enforce dependency-state update discipline in dependency graph mode via validator options (CLI must pass the mode flag).
- Add deterministic budgeting/report outputs so assistants can expand/prune selection predictably.

## Working model (high signal)

- Context-mode allowlist selection is computed as: Base (system docs + dependency.meta.json + dependency.state.json when present + repo-root base files) + dependency-state closure nodeIds, with explicit excludes as hard denials and reserved denials always enforced.
- Context-mode archiving should not rely on the default denylist-driven selection; it should archive only from an explicit allowlist of repo-relative paths.
- Engine now has internal building blocks for context mode:
  - allowlist full archive creation (`createArchiveFromFiles`)
  - allowlist diff archive creation + snapshot handling (`createArchiveDiffFromFiles`)
  - allowlist planning (`computeContextAllowlistPlan`)
  - context-mode orchestration (stage selected externals, then archive from allowlist)
- Response validation has an optional dependency-mode rule: require either a `dependency.state.json` patch or the exact “dependency.state.json: no change” bullet under `## Input Data Changes`, and reject no-op state patches.

## Open questions

- Where budgeting/report generation should live (stan-core vs stan-cli) and what minimal artifacts to emit (JSON + human-readable summary).
- What the initial CLI wiring should look like (new context-mode entrypoints vs retrofitting existing archive-flow wrappers).