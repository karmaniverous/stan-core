# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (System prompt alignment)

## Current focus

- Response/reply validator has been removed from `stan-core` (code/tests/docs), because the CLI patch workflow only sees user-copied patch payloads (not the full assistant reply).
- Dependency selection enforcement is human-gated:
  - `.stan/context/dependency.state.json` captures WHAT is selected for the next run.
  - `.stan/system/stan.scratch.md` captures WHY it was selected (decision record for the next thread/run).
- Documentation follow-through:
  - Align `guides/stan-assistant-guide.md` with current context-mode implementation (v2 meta/state + host-private `dependency.map.json`, current staging/validation APIs, meta archive clean-slate).
- Interop:
  - Responded to stan-cli: meta archive labeling must not be inferred from output filename; prefer explicit `kind` (or `SelectionReport.kind`).
- System prompt follow-through:
  - Updated `.stan/system/parts/` to reflect the patch-only ingestion reality and to prohibit web search for in-repo code when archives are available.
  - Reminder: `.stan/system/stan.system.md` is generated; run `npm run gen:system` to regenerate the monolith from parts.

## Next step

- Resume TypeDoc coverage for the public engine API (`src/**`) after the breaking removal is released.