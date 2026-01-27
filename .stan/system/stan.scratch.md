# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (META archive contract sync; final sweep)

## Current focus

- Context-mode dependency selection remains assistant + prompt + human gated (patch-only ingestion means tools may only see copied patch payloads, not whole replies).
- Dependency state (WHAT): `<stanPath>/context/dependency.state.json` (v2: `{ "v": 2, "i": [...], "x"?: [...] }`).
- Scratch (WHY): `<stanPath>/system/stan.scratch.md` is rewritten each patch-carrying turn to record rationale/decisions for the next turn/thread.
- META archive filename: there is no `archive.meta.*` artifact in current STAN; `stan run --context --meta` writes the META archive as `<stanPath>/output/archive.tar` and does not write `archive.diff.tar`.
- META archive contents: includes both `<stanPath>/context/dependency.meta.json` and `<stanPath>/context/dependency.state.json` (host writes `{ "v": 2, "i": [] }` before archiving for a clean slate).
- `stan run --context` (non-meta) writes only `<stanPath>/output/archive.diff.tar`; it may include dependency meta/state only when those files change.
- Repo docs/code should not reference `archive.meta.tar` anymore (it is not part of the contract).

## Next step

- Coordinate with stan-cli to ensure selection/archiving behavior matches: non-context archives exclude dependency meta/state; context/meta runs follow the new archive contract.