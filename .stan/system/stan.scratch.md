# STAN Scratch (short-term memory)

Last updated: 2026-01-26Z

## Current focus

- Ensure every exported symbol has an appropriate TypeDoc/TSDoc comment.
- This turn: added explicit docs for exported Rollup/Vitest/ESLint config exports (repo-root files available in `archive.meta.tar`).

## Next step

- Finish TypeDoc coverage for the actual library API under `src/**`.
  - Meta archive does not include `src/**`, so create/use `.stan/context/dependency.state.json` to expand context from `src/index.ts` and `src/stan/index.ts` (depth 5) and re-run archive.

## Open questions

- Confirm whether the scope is strictly the published public API (exports reachable from `src/index.ts`) or literally all `export` statements in the repo (including tool/config files).