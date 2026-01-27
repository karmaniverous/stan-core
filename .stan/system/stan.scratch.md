# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (Remove reply validator + scrub docs)

## Current focus

- Response/reply validator has been removed from `stan-core` (code/tests/docs), because the CLI patch workflow only sees user-copied patch payloads (not the full assistant reply).
- Dependency selection enforcement is human-gated:
  - `.stan/context/dependency.state.json` captures WHAT is selected for the next run.
  - `.stan/system/stan.scratch.md` captures WHY it was selected (decision record for the next thread/run).

## Next step

- Resume TypeDoc coverage for the public engine API (`src/**`) after the breaking removal is released.