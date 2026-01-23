# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Follow through on stan-cli wiring to consume and present `onSelectionReport` (presentation-only; engine remains silent). See `.stan/interop/stan-cli/20260123-233830Z-selection-report-wiring.md`.

## Working model (high signal)

- User-facing docs (README and `guides/stan-assistant-guide.md`) should match implemented behavior (selection precedence, archive/diff/snapshot semantics, context mode, patch pipeline, File Ops, validator switches).
- Internal docs (system prompt parts + TSDoc) should also match implementation to avoid governance drift.
- Meta archive behavior: includes system docs + dependency meta; includes `.stan/context/dependency.state.json` when present; excludes staged payloads under `.stan/context/{npm,abs}/**` by omission and excludes `.stan/system/.docs.meta.json`.

## Open questions

- None in stan-core right now; waiting on stan-cli presentation wiring for selection report summaries (engine stays presentation-free).