# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Fix TypeDoc warnings in `npm run docs` and re-run docs to confirm 0 warnings.
- Keep context-mode allowlist-only archiving building blocks green (typecheck/lint/test are passing).
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
- TypeDoc warnings addressed by ensuring exported API types are re-exported and by aligning TSDoc param names with actual function signatures.

## Open questions

- Whether “selection report” output should live in stan-core or be assembled in stan-cli (engine should remain presentation-free; core may still expose pure summary helpers).
- What minimal report schema should be standardized for assistants (bytes, bytes/4, largest entries, deterministic warnings).
