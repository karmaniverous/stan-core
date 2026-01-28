# STAN Scratch (short-term memory)

Last updated: 2026-01-28Z

## Current focus

- Implement “stop-and-stage” guardrails in dependency graph mode to prevent speculative patches for repo files not loaded via archives.
- Prompt behavior: in dependency graph mode, `## Input Data Changes` must include:
  - Patch targets outside `<stanPath>/system/**` with `present: yes|no`.
  - Dependency selection shown as dependency.state.json seed entries (`i`/`x`) only (no closure expansion), or `dependency.state.json: no change`.
- Hard gate: if any patch target is not present in the current archive, do a stage-only turn (dependency.state.json + scratch + todo + commit) and request a new `stan run --context` archive/diff.

## Next step

- Regenerate `.stan/system/stan.system.md` from parts (`npm run gen:system`) after applying the prompt-part patches.