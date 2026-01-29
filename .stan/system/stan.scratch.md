# STAN Scratch (short-term memory)

Last updated: 2026-01-29Z

## Current focus

- Close the stan-cli interop gap for context mode Option B FULL+DIFF by making the allowlist FULL primitive (`createArchiveFromFiles`) a stable public API and documenting the correct engine-owned context orchestration path.
- Core semantic expectation for context mode:
  - FULL archive must be allowlist-only: Base (system + dependency meta/state + repo-root base files) + dependency-state-selected closure.
  - DIFF must be computed against a context-specific snapshot baseline (e.g., `.archive.snapshot.context.json`) for that same allowlist universe.

## Next step

- Coordinate with stan-cli to ensure it uses `createContextArchiveWithDependencyContext` / `createContextArchiveDiffWithDependencyContext` for context FULL+DIFF (not the denylist `createArchive` path).