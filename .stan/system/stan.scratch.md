# STAN Scratch (short-term memory)

Last updated: 2026-01-25Z

## Current focus

- Adopt dependency context v2 end-to-end (meta/state compact; map host-private).
- Lock archive composition rules for non-context vs `--context` vs `--context meta`, including `--combine` behavior.
- Implement `dependency.map.json` generation + persistence in stan-core (Option A) and refactor validation to be map-driven.

## Working model (high signal)

- Assistant-facing:
  - `.stan/context/dependency.meta.json` (v2) contains traversal + sizing + optional descriptions and MUST NOT contain content hashes.
  - `.stan/context/dependency.state.json` (v2) is assistant-authored directives (seeds + depth + kindMask).
- Host-private:
  - `.stan/context/dependency.map.json` binds canonical nodeId (archive address) to locatorAbs + size + full sha256 for staging verification and MUST NOT be archived.
- Archive composition:
  - Threads start with FULL or META archives (never DIFF).
  - Config `includes`/`excludes` are ignored for any paths under `.stan/**`; `.stan/**` selection is engine-owned.
  - In `--context meta`, omit dependency state always (clean slate for selections).
  - In `--context full`, include dependency meta + dependency state (when present) + all state-selected files, with config `excludes` as hard denials for repo paths outside `.stan/**`.
  - In `--combine`, include `.stan/output/**` inside archives but exclude the known STAN archive files.

## Decisions

- Breaking changes are acceptable; optimize for compactness and deterministic selection.
- META archive includes repo-root base + system prompt + outputs (combine) + dependency meta; dependency state is intentionally omitted.
- `validateDependencySelection` remains in stan-core and becomes `dependency.map.json`-driven.