# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (Dependency state contract alignment)

## Current focus

- Eliminate internal inconsistency in the generated system prompt by updating `.stan/system/parts/240-dependency-graph-mode.md`:
  - Document dependency state schema as v2 only (`v: 2`, `i`/`x`, numeric `kindMask`).
  - Ensure meta archive semantics are “omit dependency.state.json always” (clean slate).
  - Make the cross-turn contract explicit: either patch `dependency.state.json` with a real change or emit the exact `dependency.state.json: no change` signal; no no-op state patches.
- Mirror the same cross-turn contract in `guides/stan-assistant-guide.md` so it’s discoverable outside the system prompt.
- Keep termination guidance aligned: request a new thread when a safe dependency-state update is no longer feasible within remaining context.

## Next step

- Regenerate `.stan/system/stan.system.md` from parts (`npm run gen:system`) so the monolith reflects the corrected v2 dependency-state contract.