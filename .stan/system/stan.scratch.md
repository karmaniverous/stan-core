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
  - The META archive includes system prompt + outputs (combine) + dependency meta + repo-root base; omission of dependency state is intentional to avoid “directives without payload” confusion.

## Decisions

- Breaking changes are acceptable; optimize for compactness and deterministic selection.
- META archive includes repo-root base + system prompt + outputs (combine) + dependency meta; dependency state is intentionally omitted.
- `validateDependencySelection` remains in stan-core and becomes `dependency.map.json`-driven.
## Next thread plan (implementation “Slice 1”)

- Implement engine-owned `<stanPath>/**` selection behavior:
  - Ignore config `includes`/`excludes` for any candidate paths under `.stan/**`.
  - Ensure engine-owned STAN selections always include system prompt + imports (and other key STAN files per existing rules), regardless of `.gitignore` changes.
  - Ensure `.stan/context/dependency.map.json` is never archived (reserved denial).
- Implement `--combine` support for context META archives:
  - Meta archive must include `.stan/output/**` contents under combine while excluding known STAN archive files.
  - Keep `.stan/system/.docs.meta.json` excluded from meta archives.
- Keep `--context` lifecycle constraints:
  - Thread starts from FULL or META (never DIFF-only).
  - Context META omits dependency state always.
  - Context FULL includes dependency state when present and includes dependency-selected files (closure), with config excludes as hard denials for repo paths outside `.stan/**`.

## Context note

- We are close to context limits; this scratch file is intended to carry the full decision record into the next thread so we can finish the swing without re-litigating semantics.