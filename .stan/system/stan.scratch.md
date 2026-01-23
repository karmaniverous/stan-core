# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Keep context-mode allowlist-only archiving building blocks green (typecheck/lint/test are currently passing).
- Close the loop on release readiness in stan-core: run build/docs/knip and eliminate TypeDoc warnings.
- Coordinate with stan-cli to wire context-mode allowlist-only archiving (Base + dependency closure) into the CLI runner.

## Working model (high signal)

- Context-mode allowlist selection is computed as: Base (system docs + dependency meta/state + repo-root base files) + dependency-state closure nodeIds, with explicit excludes as hard denials and reserved denials always enforced.
- Context-mode archiving should not rely on the default denylist-driven selection; it should archive only from an explicit allowlist of repo-relative paths.
- Engine now has internal building blocks for context mode:
  - allowlist full archive creation (`createArchiveFromFiles`)
  - allowlist diff archive creation + snapshot handling (`createArchiveDiffFromFiles`)
  - allowlist planning (`computeContextAllowlistPlan`)
  - context-mode orchestration (`createContextArchiveWithDependencyContext`, `createContextArchiveDiffWithDependencyContext`)
- Budgeting helper present: `summarizeContextAllowlistBudget(...)` (uses meta sizes when present; stat fallback; deterministic `bytes/4` heuristic).

## Open questions

- Whether “selection report” output should live in stan-core or be assembled in stan-cli (engine should remain presentation-free; core may still expose pure summary helpers).
- What minimal report schema should be standardized for assistants (bytes, bytes/4, largest entries, deterministic warnings).
