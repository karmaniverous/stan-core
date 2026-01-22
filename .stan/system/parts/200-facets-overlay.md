# Facet overlay (selective views with anchors)

Deprecation notice:
- Facet/anchor-based archive shaping is deprecated as the primary mechanism for
  controlling context volume.
- Prefer dependency graph mode (dependency meta + dependency state) for context
  expansion and targeting.

This repository supports “facets” — named, selective views over the codebase designed to keep archives small while preserving global context via small anchor documents.

Files (under `<stanPath>/system/`)
- `facet.meta.json` (durable): facet definitions — name → `{ exclude: string[]; include: string[] }`. The `include` list contains anchor files (e.g., README/index docs) that must always be included to preserve breadcrumbs.
- `facet.state.json` (ephemeral, should always exist): facet activation for the next run — name → `boolean` (`true` = active/no drop; `false` = inactive/apply excludes). Keys mirror `facet.meta.json`.

Overlay status for the last run
- The CLI writes a machine‑readable summary to `<stanPath>/system/.docs.meta.json` in a top‑level `overlay` block that records:
  - `enabled`: whether the overlay was applied this run,
  - per‑run overrides (`activated`/`deactivated`),
  - the final `effective` map used for selection,
  - optional `autosuspended` facets (requested inactive but kept due to missing anchors),
  - optional `anchorsKept` (paths force‑included as anchors).
- Always read this block when present; treat selection deltas that follow overlay updates as view changes (not code churn).

Assistant obligations (every turn)
1) Read facet files first:
   - Load `facet.meta.json`, `facet.state.json`, and (when present) `.docs.meta.json.overlay`.
   - Treat large selection changes after overlay edits as view expansion.
2) Design the view (facets & anchors):
   - Propose or refine facet definitions in `facet.meta.json` to carve large areas safely behind small anchors (READMEs, indices, curated summaries).
   - Keep anchor docs useful and current: when code changes public surfaces or invariants, update the relevant anchor docs in the same change set.
   - Do not deactivate a facet unless at least one suitable anchor exists under the area being hidden. If anchors are missing, add them (and record their paths under `include`) before deactivation.
3) Set the view (next run):
   - Toggle `facet.state.json` (`true`/`false`) to declare the intended default activation for the next run. This is the assistant’s declarative control of perspective across turns.
4) Response format:
   - Use plain unified diffs to update `facet.meta.json`, anchor docs, and `facet.state.json`. Summarize rationale in the commit message.

Effective activation for a run (informational)
- A facet is effectively active this run if the overlay is enabled and it resolves `true` after applying CLI precedence:
  - `-f` overrides (forces active) > `facet.state.json[name] === true` > `-F` overrides (forces inactive) > default active for facets missing in state.
- If the overlay is disabled (`--no-facets` or naked `-F`), the state still expresses the next‑run default but does not affect the current run’s selection.

Selection precedence (toolchain‑wide; informational)
- Reserved denials always win; anchors cannot override:
  - `.git/**`
  - `<stanPath>/diff/**`
  - `<stanPath>/patch/**`
  - `<stanPath>/output/archive.tar`, `<stanPath>/output/archive.diff.tar` (and future archive outputs)
  - Binary screening (classifier) remains in effect.
- Precedence across includes/excludes/anchors:
  - `includes` override `.gitignore` (but not `excludes`).
  - `excludes` override `includes`.
  - `anchors` (from facet meta) override both `excludes` and `.gitignore` (subject to reserved denials and binary screening).

Notes
- Facet files and overlay metadata are included in archives so the assistant can reason about the current view and evolve it. These files do not change Response Format or patch cadence.
- Keep facets small and purposeful; prefer a few well‑placed anchors over broad patterns.
