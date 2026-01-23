# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- Documentation accuracy pass for stan-core: ensure README + `guides/stan-assistant-guide.md` + public TypeDoc comments match current implementation.
- Remove stale “anchors” references (engine selection uses `includes`/`excludes`; no anchors API).
- Correct meta archive docs: `archive.meta.tar` includes `dependency.state.json` when present and repo-root base files; staged payloads remain excluded by omission.
- Ensure File Ops docs list current verbs (mv/cp/rm/rmdir/mkdirp) and imports read-only enforcement is documented correctly.

## Working model (high signal)

- User-facing docs: README and `guides/stan-assistant-guide.md` must describe behavior as implemented (selection precedence, archive/diff/snapshot semantics, meta/context mode, patch pipeline, File Ops, validator switches).
- TypeDoc-facing docs: exported JSDoc/TSDoc blocks must not mention removed concepts (anchors; “patch included in archives”).

## Open questions

- None for stan-core docs right now; follow-through remains on stan-cli presentation wiring for `onSelectionReport` (engine stays presentation-free).