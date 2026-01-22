# Facet‑aware editing guard (think beyond the next turn)

Purpose

Deprecation notice:
- Facets/anchors are deprecated as the primary context control mechanism.
- Prefer dependency graph mode (dependency meta + dependency state).

- Prevent proposing content patches for files that are absent from the attached archives because a facet is inactive this run (overlay enabled).
- Preserve integrity‑first intake while keeping velocity high: when a target is hidden by the current view, enable the facet now and deliver the edits next turn.

Inputs to read first (when present)- `<stanPath>/system/.docs.meta.json` — overlay record for this run:
  - `overlay.enabled: boolean`
  - `overlay.effective: Record<facet, boolean>` (true = active)
- `<stanPath>/system/facet.meta.json` — durable facet definitions:
  - `name → { exclude: string[]; include: string[] }`
  - exclude lists define facetized subtrees; include lists are anchors (always kept)

Guardrail (hard rule)
- If `overlay.enabled === true` and a target path falls under any facet whose `overlay.effective[facet] === false` (inactive this run), do NOT emit a content Patch for that target in this turn.
- Instead:
  - Explain that the path is hidden by an inactive facet this run.
  - Enable the facet for the next run:
    - Prefer a patch to `<stanPath>/system/facet.state.json` setting that facet to `true` (next‑run default), and
    - Tell the user to re‑run with `stan run -f <facet>` (overlay ON; facet active) or `stan run -F` (overlay OFF) for a full baseline.
  - Log the intent in `<stanPath>/system/stan.todo.md` (“enable facet <name> to edit <path> next turn”).
  - Deliver the actual content edits in the next turn after a run with the facet active (or overlay disabled).

Allowed mixing (keep velocity without violating integrity)
- It is OK to:
  - Patch other files that are already visible in this run.
  - Update `facet.meta.json` (e.g., add anchors) together with `facet.state.json`.
  - Create or update anchor documents (breadcrumbs) even when the facet is currently inactive — anchors are always included in the next run once listed in `include`.
- It is NOT OK to:
  - Emit a content Patch for a file under a facet you are enabling in the same turn.
  - Attempt to override reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`, and archive outputs under `<stanPath>/output/…`); anchors never override these.

Resolution algorithm (assistant‑side; POSIX paths)
1) Load `.docs.meta.json`. If absent or `overlay.enabled !== true`, skip this guard.
2) Load `facet.meta.json` and derive subtree roots for each facet’s `exclude` patterns (strip common glob tails like `/**` or `/*`, trim trailing “/”; ignore leaf‑globs such as `**/*.test.ts` for subtree matching).
3) For each intended patch target:
   - If the target lies under any facet subtree and that facet is inactive per `overlay.effective`, block the edit this turn and propose facet activation instead (see Guardrail).
4) If overlay metadata is missing but the target file is simply absent from the archive set, treat this as a hidden target; ask to re‑run with `-f <facet>` or `-F` and resume next turn.

Optional metadata (CLI nicety; not required)
- When `overlay.facetRoots: Record<facet, string[]>` is present in `.docs.meta.json`, prefer those pre‑normalized subtree roots over local glob heuristics.

Notes
- Reserved denials and binary screening always win; anchors cannot re‑include them.
- The goal is two‑turn cadence for hidden targets:
  - Turn N: enable the facet + log intent.
  - Turn N+1: deliver the content edits once the target is present in archives.
