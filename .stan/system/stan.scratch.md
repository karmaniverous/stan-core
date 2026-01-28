# STAN Scratch (short-term memory)

Last updated: 2026-01-28Z (interop note posted to stan-cli)

## Current focus

- Context-mode dependency selection remains assistant + prompt + human gated (patch-only ingestion means tools may only see copied patch payloads, not whole replies).
- Dependency state (WHAT): `<stanPath>/context/dependency.state.json` (v2: `{ "v": 2, "i": [...], "x"?: [...] }`).
- Scratch (WHY): `<stanPath>/system/stan.scratch.md` is rewritten each patch-carrying turn to record rationale/decisions for the next turn/thread.
- META archive filename: there is no `archive.meta.*` artifact in current STAN; `stan run --context --meta` writes the META archive as `<stanPath>/output/archive.tar` and does not write `archive.diff.tar`.
- META archive contents: includes both `<stanPath>/context/dependency.meta.json` and `<stanPath>/context/dependency.state.json` (host writes `{ "v": 2, "i": [] }` before archiving for a clean slate).
- Option B: `stan run --context` (non-meta) writes BOTH `<stanPath>/output/archive.tar` (FULL allowlist context) and `<stanPath>/output/archive.diff.tar` (DIFF allowlist context vs the context snapshot baseline).
- Correctness: snapshot state must be per-mode/per-universe; stan-core adds `snapshotFileName` so hosts can keep separate baselines (e.g., `.archive.snapshot.run.json` vs `.archive.snapshot.context.json`) under `<stanPath>/diff/`.
- Interop: posted `.stan/interop/stan-cli/20260128-000000Z-context-full-diff-snapshot-keying.md` with the required stan-cli wiring actions.

## Next step

- Coordinate with stan-cli to ensure context Option B is implemented using the allowlist context archive APIs and a distinct context snapshot file name.
