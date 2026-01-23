# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Make scratch the STAN-wide continuity mechanism (Base-always; read-first; rewrite-only).
- Remove anchors and facets from the STAN model entirely.
- Continue implementing `--context` allowlist-only archiving and deterministic budgeting support (dependency state is the explicit selection mechanism).

## Working model (high signal)

- `stan.scratch.md` is the default cross-thread continuity device and is always included in Base archives.
- Scratch is actively rewritten; it is not append-only and is not a durable requirements record.
- For holistic tasks under context limits, prefer breadth-first cohorts (many repo-local nodes at depth 0) and persist findings here.
- In `--context`, explicit excludes are hard denials; dependency state may override `.gitignore` but must not override excludes/reserved/binaries.
- Anchors/facets are removed from the STAN model; remove related docs and later remove any remaining engine API/impl support.

## Open questions

- None (policy direction confirmed); implement remaining engine follow-ups and budgeting/reporting work as planned.