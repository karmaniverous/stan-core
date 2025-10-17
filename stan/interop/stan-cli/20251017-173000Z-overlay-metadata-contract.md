# Contract — Archive Overlay Metadata (CLI responsibility)

Summary
- stan-cli writes a machine-readable summary of the overlay view that was
  in effect for the most recent `stan run` into
  `<stanPath>/system/.docs.meta.json`.
- Purpose: eliminate ambiguity between facet.state.json (default,
  next-run view) and any per-run overrides (`-f/-F`, `--facets`/`--no-facets`)
  so the assistant can treat selection deltas as view changes rather than code
  churn.

Path & file
- Location: `<stanPath>/system/.docs.meta.json`
- Included in archives (full and diff) every run.
- Back-compat: `overlay` is a new optional block. Absence means overlay
  metadata was not produced (older CLI), and the assistant should fall back
  to facet.meta.json + facet.state.json for inference.

JSON shape (extends existing prompt block)
```json
{
  "version": "<docs schema version>",
  "prompt": {
    "source": "local|core|auto|<path>",
    "hash": "<sha256-of-monolith-bytes>"
  },
  "overlay": {
    "enabled": true,
    "activated": ["facetA","facetB"],
    "deactivated": ["facetC"],
    "effective": { "facetA": true, "facetB": true, "facetC": false },
    "autosuspended": ["facetX"],
    "anchorsKept": ["packages/x/README.md","docs/index.md"]
  }
}
```

Semantics
- enabled:
  - `true` when overlay is active for the run (`--facets` or `-f/-F` used);
  - `false` when overlay is fully disabled (`--no-facets` or naked `-F`).
- activated / deactivated:
  - Arrays echoing the per-run `-f` and `-F` lists supplied on the CLI (if
    any). If none were supplied, emit empty arrays.
  - Precedence note: `-f` wins over `-F` for the same name.
- effective:
  - The final facet activation map used to compute the file selection for this
    run (after applying overrides). Facets absent from state default to `true`.
- autosuspended:
  - Facet names that were requested inactive for the run but were kept active
    by ramp-up safety (no anchors present under the excluded area). This is a
    warning signal; the assistant should add anchors and then deactivate.
- anchorsKept:
  - Optional convenience list of anchor file paths (POSIX repo-relative)
    that were force-included for the run. This mirrors plan output and helps
    the assistant reason about view composition.

Precedence & reserved denials (reference)
- Reserved denials always win; anchors cannot override:
  - `.git/**`
  - `<stanPath>/diff/**`
  - `<stanPath>/patch/**`
  - `<stanPath>/output/archive.tar`,
    `<stanPath>/output/archive.diff.tar` (and future archive outputs)
  - Binary screening (classifier) remains in effect.
- Selection precedence across the toolchain:
  - `includes` override `.gitignore` (not `excludes`).
  - `excludes` override `includes`.
  - `anchors` override both `excludes` and `.gitignore` (subject to reserved
    denials and binary screening).

CLI responsibilities (authoritative)
1) Determine the per-run overlay state:
   - Parse facet.meta.json (durable) and facet.state.json (ephemeral; always
     present; keys mirror meta).
   - Apply per-run overrides (`-f/-F`) to compute `effective`.
   - Determine `enabled` (see above rules).
2) Ramp-up safety:
   - If a facet is requested inactive but there are no anchors under its
     excluded subtree(s), auto-suspend that facet for this run:
     - Retain it in `effective` as `true`
     - Record its name in `autosuspended`.
     - Print a plan-time warning: “facet "<name>": no anchors found; kept code
       this run. Add an anchor in facet.meta.json include and re-run.”
3) Write `<stanPath>/system/.docs.meta.json`:
   - Preserve existing `version` and `prompt` fields; add or replace the
     `overlay` block as specified.
   - Ensure the file is present before archiving so both full and diff capture
     the overlay record used for the run.
4) Archive behavior:
   - Always include `.docs.meta.json` in both archives.
   - Ensure facet.meta.json and facet.state.json are also included so the
     assistant has the full overlay context.

Determinism & normalization
- Paths in `anchorsKept` are POSIX repo-relative (no leading `./`).
- Arrays are sorted (stable output across platforms).
- The `effective` map contains only keys present in facet.meta.json; facets
  not defined in meta are ignored for purposes of overlay.

Assistant UX implications (non-prescriptive; for the prompt)
- The assistant should:
  - read `overlay` for the last-run view,
  - evolve facet.meta.json (anchors) and facet.state.json (next-run default),
  - treat large selection changes following overlay edits as view expansion.

Acceptance criteria (CLI)
1) Writes `.docs.meta.json` with the described `overlay` block every run.
2) Correctly reflects per-run overrides and ramp-up safety in fields.
3) Included in full and diff archives.
4) Plan prints a “Facet view” that matches the `overlay` block.
5) Back-compat: runs clean when `overlay` is absent (older runs).

Notes
- Core does not write or interpret overlay metadata; it remains presentation-
  free. Core accepts an optional `anchors?: string[]` channel in selection
  surfaces (see prior interop) to ensure anchors re-include over excludes while
  respecting reserved denials.
