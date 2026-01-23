# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Remove anchors from the stan-core selection/archiving APIs and docs (done in this repo).
- Continue implementing `--context` allowlist-only archiving and deterministic budgeting/reporting (dependency state is the explicit selection mechanism).
- Keep `excludes` as hard denials; allow explicit selection to override `.gitignore` only.

## Working model (high signal)

- `stan.scratch.md` is the default cross-thread continuity device and is always included in Base archives.
- Scratch is actively rewritten; it is not append-only and is not a durable requirements record.
- Anchors are removed from the stan-core engine API and selection semantics; use `includes` to override `.gitignore`.
- `excludes` are hard denials everywhere (Base + closure + staged externals); no selection channel may bypass them.
- Next work is `--context` allowlist-only archiving + deterministic budgeting output (size aggregation from dependency meta/state).

## Open questions

- None; proceed with context-mode allowlist archiving + budgeting/reporting implementation.