# STAN Scratch (short-term memory)

Last updated: 2026-01-25Z (Turn 6)

## Current focus

- Adopt dependency context v2 end-to-end (compact meta/state + host-private `dependency.map.json`).
- COMPLETED: All lint errors resolved.
- NEXT: Final validation.

## Working model (high signal)

- Assistant-facing:
  - `.stan/context/dependency.meta.json` v2 (compact): traversal + sizing + optional descriptions; no hashes.
  - `.stan/context/dependency.state.json` v2 (compact): directives (include/exclude + depth + kindMask).
- Host-private:
  - `.stan/context/dependency.map.json`: canonical nodeId → locatorAbs + size + full sha256 (staging verification); never archived.
- Archive composition:
  - `--context meta` omits dependency state always (clean slate).
  - Config includes/excludes are ignored under `<stanPath>/**` (engine-owned selection).

## Decisions

- Slice 1 implemented in stan-core:
  - Engine-owned STAN selection exceptions: include `<stanPath>/system/**` (excluding `.docs.meta.json`) and `<stanPath>/imports/**` regardless of `.gitignore`/config.
  - Reserved `<stanPath>/context/dependency.map.json` so it is never archived.
  - Meta archive omits dependency state always; optional include `<stanPath>/output/**` for combine mode.
  - Follow-up fix: allow `includes` to re-include gitignored `<stanPath>/context/**` for dependency archive-flow wrappers; fixed test tmp import path.

## Context note

- All context tests updated to V2.