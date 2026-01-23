# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Establish `stan.scratch.md` as STAN-wide short-term memory and remove the handoff mechanism from the system prompt model.
- Continue implementing `--context` allowlist-only archiving and deterministic budgeting support.

## Working model (high signal)

- `stan.scratch.md` is the default cross-thread continuity device and is always included in Base archives.
- Scratch is actively rewritten; it is not append-only and is not a durable requirements record.
- For holistic tasks under context limits, prefer breadth-first cohorts (many repo-local nodes at depth 0) and persist findings here.

## Open questions

- None (policy direction confirmed); implement remaining validator/tooling follow-ups as separate work.
