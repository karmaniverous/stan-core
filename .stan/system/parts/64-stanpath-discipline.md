# stanPath discipline (write‑time guardrails)

Purpose

- Ensure all assistant‑emitted patches and file operations target the correct STAN workspace directory for this repository (the configured `stanPath`).
- Prevent common errors where patches are written to `stan/…` when the repo uses `.stan/…` (or vice‑versa), or where the literal placeholder `<stanPath>` appears in patch paths.

Resolve stanPath first (required)

1. Read `stan.config.yml|yaml|json` and extract `stan-core.stanPath`:
   - The value MUST be a non‑empty string; when present, treat it as authoritative.
2. If the config is not present in the archive, derive from observed layout:
   - Prefer the workspace directory that actually exists in the attached artifacts (e.g., `.stan/system/…`).
   - If both `.stan/…` and `stan/…` appear (unusual), prefer the one that contains `system/stan.system.md` or `system/` docs.
3. Fallback default (last resort): `.stan`.

Write‑time rules (hard)

- Always use the resolved `stanPath` for all repo‑relative targets under the STAN workspace:
  - `/<stanPath>/system/**`
  - `/<stanPath>/diff/**`
  - `/<stanPath>/output/**`
  - `/<stanPath>/patch/**`
  - Any other STAN paths (imports, dist, etc.).
- Never write to `stan/…` unless `stanPath === "stan"`.
- Never write to `.stan/…` unless `stanPath === ".stan"`.
- Never leave the literal placeholder `<stanPath>` in any patch path or File Ops argument. Compute concrete POSIX repo‑relative paths before emitting.

Pre‑send validation (assistant‑side check)

- Fail composition if any Patch path contains the literal `<stanPath>`.
- Fail composition if any Patch path refers to `stan/…` when `stanPath === ".stan"`, or `.stan/…` when `stanPath === "stan"`.
- Paths MUST be POSIX (forward slashes) and repo‑relative.

Input clarity (optional)

- In “Input Data Changes” or the first relevant section of a reply, it is acceptable (not required) to echo the resolved `stanPath` for this run, e.g., “stanPath resolved: `.stan`”. This helps reviewers spot a mismatch early.

Notes

- These rules apply only to assistant‑emitted content (patches and file ops). The bootloader’s read‑side fallbacks (e.g., probing `.stan` then `stan`) exist for compatibility with older archives and do not affect write‑time discipline.
- The rules compose with other guards:
  - Reserved denials remain in effect (e.g., do not place content under `/<stanPath>/diff/**`, `/<stanPath>/patch/**`, or archive outputs in `/<stanPath>/output/**`).
  - The facet‑aware editing guard still applies: do not propose edits under an inactive facet this run; enable the facet first and emit patches next turn.
