# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Close the remaining documentation drift items after the last doc pass.
- Fix TSDoc in `src/stan/diff.ts` that still claims `includes` override `excludes` (they do not; `excludes` win).
- Fix remaining meta archive docs drift in `guides/stan-assistant-guide.md` (meta archive includes dependency state when present).
- Remove remaining “anchors” references in `.stan/system/stan.requirements.md` that no longer reflect the engine API.

## Working model (high signal)

- User-facing docs: README and `guides/stan-assistant-guide.md` must describe behavior as implemented (selection precedence, archive/diff/snapshot semantics, meta/context mode, patch pipeline, File Ops, validator switches).
- TypeDoc-facing docs: exported JSDoc/TSDoc blocks must not mention removed concepts (anchors; “patch included in archives”).

## Open questions

- None for stan-core docs right now; follow-through remains on stan-cli presentation wiring for `onSelectionReport` (engine stays presentation-free).