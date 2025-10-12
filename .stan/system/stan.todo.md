# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Docs (namespaced model only)
  - Update README and examples to show the namespaced `stan-core`/`stan-cli` layout exclusively.
  - Add a brief migration note pointing users to “stan init” (CLI).

- Config tests (strict engine loader)
  - Add a unit test that rejects unknown keys inside `stan-core` (negative case).
  - Add a JSON-path variant of the missing-section error.

- Typedoc (zero warnings)
  - Resolve the remaining AttemptCapture warning by exporting the type or adjusting the reference.

- DRY test scaffolding
  - Introduce shared `writeStanConfigYaml/Json` and `withMockTarCapture` helpers.
  - Adopt incrementally in a few suites.

- Optional DRY set (later)
  - Hoist additional small shared helpers if duplication appears during CLI alignment.
  - Keep modules ≤ 300 LOC.

---

## Completed (recent)

- System prompt — dev plan logging rules
  - Completed is the final section; new entries are appended at the bottom (append‑only).
  - No edits to existing Completed items; clarifications/corrections are logged as new list entries (amendments to the list).
  - Prune Completed entries not needed to understand work in flight; keep minimal context only.
  - No numbering in the dev plan (use nested bullets); a short, strictly ordered sub‑procedure may use a local numbered list when needed.

-
- System prompt — diagnostics clarity (polish)
  - Quick Reference rule #6 now explicitly distinguishes normal replies (patches by default; listings on request) from diagnostics replies (Full Listings only; no patches).
  - Added a one‑sentence definition of “post‑patch listing” in the patch‑failure follow‑up: listings MUST reflect the target state implied by the failed hunks; never print the original body.

-
- System prompt — diagnostics clarity
  - Removed legacy wording that implied Full Listings are “optional on request” for patch‑failure replies. Response Format now explicitly scopes “optional listings” to normal replies only and makes diagnostics listings mandatory (no patches, union across envelopes, no commit message). Quick rules now call this out explicitly alongside the 300‑LOC decomposition pivot for listings.

- System prompt — guardrails & diagnostics
  - 300‑LOC hard gate + decomposition pivot: never emit a patch that makes a file exceed 300 LOC; pivot to File Ops + multiple patches. When producing listings (diagnostics), if a file would exceed 300 LOC, decompose and list the new files instead of the monolith.
  - Patch‑failure replies: always provide Full, post‑patch listings ONLY (no patches) for each affected file; when multiple envelopes are pasted, list the union of all referenced files; skip the Commit Message in diagnostics replies.
  - No mixing: never deliver a Patch and a Full Listing for the same file in the same turn; Response Format and validation text updated accordingly.

- Lint & docs polish
  - Fixed tsdoc “\>” escape in creation‑fallback comment and removed a useless escape in a regex character class to satisfy ESLint.
  - Re‑exported `ApplyResult` so Typedoc includes the type referenced by `PipelineOutcome.result` (eliminates the last documentation warning).

- Patch engine fidelity
  - Implemented creation‑patch fallback (post git+jsdiff) for confident `/dev/null → b/<path>` diffs. Honors `--check` by writing to `.stan/patch/.sandbox/F/<path>`; writes to repo otherwise.

- Typedoc polish
  - Re‑exported public types referenced by top‑level APIs (`PipelineOutcome`, `JsDiffOutcome`, `AssembleResult`, `FileOpsPlan`, `OpResult`, `ImportsMap`) to remove documentation warnings.

- Maintenance (knip/interop)
  - Temporarily ignored six knip‑flagged helpers in stan‑core.
  - Posted an interop note to stan‑cli requesting a yes/no on moving patch helpers (context/detect/headers) vs deleting no‑ops/redundant items.

- Test fix (config.load)
  - Normalized Zod error wording for a scripts type‑mismatch to the stable message “scripts must be an object” so the `config.load` extra test matches `/scripts.*object/i`.

- Typecheck cleanup
  - Fixed Zod v4 record overload usage by specifying key schema in `z.record(...)` for `ImportsSchema` and `ScriptsSchema`.
  - Tightened typing in config loader: cast validated `parsed.scripts` to `ScriptMap` to satisfy TS while preserving schema guarantees.
  - Resolves TS errors reported in typecheck output for `schema.ts` and `load.ts`.

- Top-level surface readiness
  - Exposed prompt helpers at the engine barrel: `getPackagedSystemPromptPath` and `assembleSystemMonolith` are now importable from the package top level.
  - Normalized package "types" to `dist/types/index.d.ts` to match generated Rollup d.ts outputs and the `exports` map. Ensures CLI consumers can import all surfaces via `@karmaniverous/stan-core` without subpaths.

- Console‑free surfaces (phase 1)
  - Archive: `createArchive` / `createArchiveDiff` now surface classifier warnings via optional `onArchiveWarnings(text)` callback; engine emits no console output. Tests updated to assert callbacks (no console spies).
  - Imports: `prepareImports` accepts optional `onStage(label, files[])` and no longer logs to console. Callback reports repo‑relative staged paths; tests updated to assert invocation.

- Engine surface hygiene
  - Removed presentation helpers from core:
    - Deleted `src/stan/util/{color.ts,status.ts,time.ts}` (engine is transport/presentation‑free).
  - Exported `CORE_VERSION` from the engine barrel; added a unit test that asserts presence and shape. This enables stan‑cli’s `--core` banner and compatibility checks without coupling.

- Interop coordination (exports confirmation)
  - Posted `.stan/interop/stan-cli/20251002-exports-confirmed.md` confirming top‑level exports for config, selection, archive/diff/snapshot, patch engine, imports staging, validation, prompt helpers, and `CORE_VERSION`. Package “types” normalized to `dist/types/index.d.ts`; CLI can import all surfaces via `@karmaniverous/stan-core` without subpaths.

- Posted interop guidance to stan‑cli identifying engine‑duplicate modules safe to delete and the corresponding `@karmaniverous/stan-core` imports to adopt.

- Removed `readPatchSource` from core and delegated patch source acquisition to stan‑cli.
  - Core remains string‑first: stan‑cli acquires raw text, calls `detectAndCleanPatch`, writes to `<stanPath>/patch/.patch`, then invokes `applyPatchPipeline`.

- Core/CLI decomposition (phase 1)
  - Removed CLI adapters/runner from the engine code base; pruned CLI‑only services/tests.
  - Rollup builds library and types only; CLI bundle removed.
  - Package metadata converged on engine‑only usage.
  - Archive warnings de‑colored; decoupled from CLI styling.
  - Patch barrel exports surfaced engine primitives.
  - Typedoc documents reflect engine‑only surfaces; CHANGELOG retained.
  - knip hints addressed; unused config entries pruned.

- Change of direction — namespaced config (stan-core/stan-cli)
  - Adopted top‑level namespacing in `stan.config.*`: `stan-core` for engine, `stan-cli` for CLI. Backward compatibility is not a factor beyond keeping STAN functional during the brief transition.
  - Core: strict loader for `stan-core` (no root passthrough); minimal schema only; error when missing section.
  - CLI: strict loader for `stan-cli`; drop `x-stan-cli`/legacy acceptance after coordinated release.
  - Tests and docs updated to reflect namespaced model; examples and init templates updated.
  - Interop: posted `.stan/interop/stan-cli/20251011-000000Z-config-namespacing-switch.md` with loader drop‑in and release guidance.
  - Follow‑through: remove transitional acceptance as soon as both packages publish namespaced loaders; communicate in release notes.

- Core — implemented strict namespaced loader
  - `loadConfig`/`loadConfigSync` now read only the top‑level `stan-core` section and fail fast when missing (friendly message).
  - `configSchema` is strict inside `stan-core` (unknown keys rejected); minimal fields only.
  - Removed CLI normalization from core (`normalizeCliDefaults`, `CliDefaults` types) and fixed TSDoc “\>” escapes to satisfy lint.
  - Updated tests to write `stan-core` namespaced configs for JSON/YAML; added a missing‑section error case.
  - Keeps STAN functional during release sequencing; no root‑object fallback in core.

-
- Interop housekeeping — prune resolved notes (config swing)
  - Removed resolved interop messages under `.stan/interop/stan-cli/` now that CLI has adopted top‑level namespacing:
    - `20251010-000000Z-core-config-slimming-and-cli-config.md`
    - `20251011-000000Z-config-namespacing-switch.md`
  - This enables stan-cli to drop imports of core interop threads and keeps archives lean.
  - Current state:
    - Core: strict `stan-core` loader in place; tests/docs aligned.
    - CLI: strict `stan-cli` loader adopted with a short transitional legacy extractor to keep the loop green during sequencing (per CLI requirements).
  - Follow‑through: remove any remaining transitional acceptance paths once both packages are fully released on the namespaced model.

- DRY set 1 — shared helpers and micro‑consolidations (no behavior changes)
  - File Ops: introduced a shared extractor at `src/stan/patch/common/file-ops.ts` and updated both the File Ops parser and the response validator to use it.
  - Repo paths: added `src/stan/path/repo.ts` with `normalizeRepoPath`, `isAbsolutePosix`, `toPosix`, and `resolveWithin`. File Ops parser and validator now share the same safety rules.
  - jsdiff writes: replaced ad‑hoc mkdir logic with the existing `ensureParentDir` helper for both repo and sandbox targets.
  - Archive composition: centralized inclusion of `<stanPath>/output` via `composeFilesWithOutput` in `src/stan/archive/util.ts`; used by archive and diff.
  - Tests: no behavior changes expected; kept coverage stable.

- DRY set 2 — diff/EOL/config helpers and polish (no behavior changes)
  - Added `src/stan/patch/common/diff.ts` (isUnifiedDiff/extractFirstUnifiedDiff/normalizePatchText); refactored `clean.ts` and `detect.ts` to use it.
  - Added `src/stan/text/eol.ts` (toLF/ensureFinalLF); `assemble.ts` now imports `toLF` instead of a local function.
  - Validator now imports `toPosix` from `src/stan/path/repo.ts` and removes a duplicated doc line.
  - Archive warnings surfaced via `surfaceArchiveWarnings` in `src/stan/archive/util.ts`; used by archive and diff.
  - Config loader uses shared helpers in `src/stan/config/common.ts` (formatZodError/parseRoot/normalizeImports) to reduce duplication.
  - Tests remain green; no public API changes.

- Docs — alignment with namespaced engine config and env switches
  - README: updated config section to reference the top‑level `stan-core` block and replaced outdated `cliDefaults/scripts` references with the minimal engine `ContextConfig` fields (`stanPath`, `includes`, `excludes`, `imports`).
  - New ENVIRONMENT.md: enumerates all environment variables observed by the engine, test harness, and release scripts (scope/values/examples).
  - typedoc.json: added ENVIRONMENT.md to `projectDocuments` so the page is published with the generated site.

- Typedoc — zero warnings
  - Re‑exported `AttemptCapture` from the patch barrel so Typedoc includes the
    referenced type used by `ApplyResult.captures`.