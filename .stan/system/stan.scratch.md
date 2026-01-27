# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (Requirements ↔ implementation sync)

## Current focus

- Context-mode dependency selection is assistant + prompt + human gated (patch-only ingestion means tools may only see copied patch payloads, not whole replies).
- Dependency state (WHAT): `<stanPath>/context/dependency.state.json` (v2: `v: 2`, `i`/`x`, numeric `kindMask`).
- Scratch (WHY): `<stanPath>/system/stan.scratch.md` is rewritten each patch-carrying turn to record rationale/decisions for the next turn/thread.
- Meta archive is a clean slate: `<stanPath>/output/archive.meta.tar` includes `<stanPath>/context/dependency.meta.json` but omits `dependency.state.json` always.
- Config `includes`/`excludes` do not apply under `<stanPath>/**` (engine-owned). Do not expect config `excludes` to remove staged dependency payloads under `<stanPath>/context/**`.

## Next step

- Resume normal engine work (tests/docs/TypeDoc follow-through) now that dependency-state guidance is consistent across system prompt, docs, and implementation.