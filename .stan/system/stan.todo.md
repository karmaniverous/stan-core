# STAN Development Plan

When updated: 2025-10-01 (UTC)

This plan tracks two synchronized tracks in preparation for splitting the code base into two packages: stan-core (engine) and stan-cli (CLI/runner). Until the repo is duplicated, both tracks live here; after duplication, each repo will retain only its corresponding track.

---

## Track A — stan-core (engine)

### Next up (priority order)

- Core/CLI decomposition — phase 1 (stan-core):
  - [x] Remove CLI adapters and runner/TTY UI from stan-core (src/cli, src/stan/run, preflight/init/snap/help/version, patch CLI service and open).
  - [x] Stop building CLI in Rollup; build library and types only.
  - [x] Remove CLI runtime deps from package.json; drop “stan” bin/script.
  - [x] Replace colored archive warnings with colorless logging in core.
  - [x] Narrow public exports to engine-only (drop run/help).
  - [ ] Follow-up: eliminate remaining console I/O from core APIs; return warnings/notes via return values only.
  - [x] Follow-up: expose patch pipeline/file-ops/types explicitly from the top-level barrel and update README/docs to reflect engine usage.
  - [ ] Follow-up: confirm no engine modules depend on package-directory/module root in runtime paths (trim if unnecessary).
  - [ ] Follow-up: move CLI behavior/tests into stan-cli repo and wire to stan-core package.

---

- Extract engine package scaffolding
  - Create a new repo/package “@karmaniverous/stan-core”.
  - Copy engine modules:
    - config/, fs.ts, fs/reserved.ts, paths.ts
    - archive.ts (+ archive/constants.ts), archive/util.ts (return warnings)
    - diff.ts, snap/{capture,shared,context}.ts
    - patch/** (apply, jsdiff, detect, headers, parse, file-ops, diag/util, run/pipeline, util/fs)
    - imports/stage.ts
    - validate/response.ts (optional export)
  - Remove CLI/runner/process/TTY concerns.

- Remove console I/O from core
  - Replace console.log in archive/util.ts with a return value (warningsBody) surfaced to the caller.
  - Ensure snap history helpers return data/events only.

- Patch ingestion — creation fallback (new)
  - Implement “creation patch” heuristic in stan-core:
    - When unified‑diff application fails and the patch is confidently detected as a new-file creation (e.g., /dev/null → b/<path>), strip diff headers and decode body by removing leading “+” from each payload line.
    - Normalize to LF and create parent directories for nested paths.
    - Gate behind the standard pipeline: only runs after git/jsdiff fail and only for new-file patches.
  - Add unit tests covering:
    - Simple creation, nested path, fenced chat artifacts, sandbox (check=true).

- API surface and types
  - Export public APIs listed in stan.requirements.md; ensure stable d.ts.
  - Document return contracts where logging was removed.

- Imports bridge (context from cli)
  - Add a task to configure imports in stan-core’s stan.config.yml:
    - label: “cli-docs”
    - patterns: paths to staged stan-cli docs (README, CHANGELOG, docs/).

- Cross‑repo recommendation
  - Update stan.project.md in stan-core with a section that instructs the assistant to recommend stan-cli changes for any adapter/UX concerns.

- Packaging & CI
  - Rollup build for library + d.ts bundle (no CLI bundle).
  - Ensure tar & fs-extra are runtime deps; no Commander/inquirer/log-update.
  - Publish under a pre-release tag for initial integration.

### Backlog / follow‑through

- Performance profiling for large repos (selection and tar streaming).
- Optional logger injection pattern (future) to support structured logging.

### Completed (recent)

- Decomposition (phase 1, core):
  - Removed CLI adapters and runner from stan-core; pruned CLI-only services/tests.
  - Simplified Rollup build to library + types; trimmed CLI bin/script and deps.
  - Core archive warnings now log without color (no chalk).

- Split hygiene (core):
  - Removed CLI/runner tests from core: src/stan/diff.test.ts, src/stan/run.combine.test.ts, src/stan/run.plan.test.ts, src/stan/run.test.ts.

- Docs pruning (core):
  - Removed CLI-focused docs under docs-src/; restricted typedoc project documents to CHANGELOG only.

- Tooling housekeeping:
  - knip: removed @types/eslint__js from ignoreDependencies; unresolved import warnings resolved with test removals and patch barrel fix.

- Developer-facing docs & exports:
  - Exposed patch engine and imports staging from top-level barrel.
  - Refreshed README for engine-only usage; updated package description/keywords.

---

## Track B — stan-cli (CLI and runner)

### Next up (priority order)

- Wire stan-cli to stan-core
  - Replace internal imports with “@karmaniverous/stan-core” APIs:
    - config loading, selection, archive/diff, snapshot, patch pipeline, imports staging.
  - Keep CLI behaviors: preflight/docs injection, plan printing, live/logger UI, cancellation gates, editor open, clipboard source.

- Archive warnings display
  - Print stan-core’s warningsBody once per archive/diff phase in CLI.

- Runner cancellation hardening
  - Ensure the sequential scheduling gate prevents “after” scripts from starting after a SIGINT boundary; preserve late‑cancel guard before archive.

- Help/UX parity
  - Confirm BORING vs TTY parity on labels and summary lines.
  - Verify defaults tagging and conflict messages.

- Imports bridge (context from core)
  - Add a task to configure imports in stan-cli’s stan.config.yml:
    - label: “core-docs”
    - patterns: paths to staged stan-core API docs and changelog.

- Cross‑repo recommendation
  - Update stan.project.md in stan-cli with a section that instructs the assistant to recommend stan-core changes for any engine concerns (selection/patch/archiving semantics).

- Tests & docs
  - Keep existing CLI/runner integration tests; adjust to stan-core wiring.
  - Update README/help footers if flags/wording changed.

### Backlog / follow‑through

- Live table final-frame flush audit for edge cases.
- Editor-open gating policy doc (“test mode” and force‑open).
