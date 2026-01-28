# Context mode Option B + snapshot keying (stan-core changes)

This thread aligned on Option B for context mode: `stan run --context` (non-meta) should write BOTH a FULL archive (`archive.tar`) and a DIFF archive (`archive.diff.tar`), where DIFF is computed against the FULL selection universe for the same mode.

## What changed in stan-core

- Docs/prompt alignment: context non-meta is now documented as FULL+DIFF (Option B), while `stan run --context --meta` remains META-only (`archive.tar` only; no diff archive).
- Snapshot correctness fix: stan-core now supports per-mode snapshot baselines via a caller-supplied snapshot file name under `<stanPath>/diff/`:
  - denylist:
    - `createArchiveDiff({ ..., snapshotFileName?: string })`
    - `writeArchiveSnapshot({ ..., snapshotFileName?: string })`
  - allowlist/context:
    - `createArchiveDiffFromFiles({ ..., snapshotFileName?: string })`
    - new: `writeArchiveSnapshotFromFiles({ ..., snapshotFileName?: string })`
  - context allowlist diff wrapper:
    - `createContextArchiveDiffWithDependencyContext(... diff: { snapshotFileName?: string })`
- Snapshot file name validation: `snapshotFileName` must be a simple file name (no slashes, no `..`); stan-core throws on invalid values.
- Public API: `createArchiveDiffFromFiles` and `writeArchiveSnapshotFromFiles` are now exported from the top-level stan-core barrel.

## Action items for stan-cli

- Implement Option B wiring for `stan run --context` (non-meta):
  - write FULL allowlist context archive (`archive.tar`) AND DIFF allowlist context archive (`archive.diff.tar`).
- Use a distinct context snapshot baseline so denylist runs and allowlist/context runs do not clobber each other, e.g.:
  - non-context: default `.archive.snapshot.json` (or explicitly `.archive.snapshot.run.json`)
  - context: `.archive.snapshot.context.json`
- For `stan run --context --meta`:
  - continue writing META archive as `archive.tar` only (no diff archive),
  - continue writing `{ "v": 2, "i": [] }\n` to `<stanPath>/context/dependency.state.json` before archiving so the META archive includes a clean-slate state file.

Notes: stan-core still hard-reserves `<stanPath>/context/dependency.map.json` (must never be archived); dependency meta/state inclusion in non-context runs remains a host policy decision (typically governed by `.gitignore`/selection).
