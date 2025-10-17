# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- DRY helpers adoption (tests)
  - Adopt `writeStanConfigYaml/Json` and `withMockTarCapture` across remaining suites to reduce duplication and improve test clarity.
  - Do this incrementally (archive/diff first), keeping changes localized to test code.
  - Acceptance criteria:
    - No change in production behavior.
    - Suites that adopt helpers should have simpler setup with equal or better coverage.
    - CI runtime does not regress.

- Optional DRY set (later)
  - Hoist additional small shared helpers if duplication appears during CLI alignment.
  - Keep modules ≤ 300 LOC.

---

## Completed (recent)

- Interop (stan-cli) — prompt resolution tests & fallback
  - Posted `.stan/interop/stan-cli/20251013-170500Z-prompt-resolution-tests.md` proposing a robust `resolveCorePromptPath` helper, unit tests for local/core selection (including fallback with spaces), and a plan-only integration test.

---

## Completed (recent)

- Core — implemented strict namespaced loader
  - `loadConfig`/`loadConfigSync` now read only the top‑level `stan-core` section and fail fast when missing (friendly message).
  - `configSchema` is strict inside `stan-core` (unknown keys rejected); minimal fields only.
  - Removed CLI normalization from core (`normalizeCliDefaults`, `CliDefaults` types) and fixed TSDoc “\>” escapes to satisfy lint.
  - Updated tests to write `stan-core` namespaced configs for JSON/YAML; added a missing‑section error case.
  - Keeps STAN functional during release sequencing; no root‑object fallback in core.

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
  - Re‑exported `AttemptCapture` from the patch barrel so Typedoc includes the referenced type used by `ApplyResult.captures`.

- Tests — packaged prompt resolution independent of cwd
  - Added `src/stan/module.cwd.test.ts` to assert `getPackagedSystemPromptPath` returns the packaged prompt path even when `process.cwd()` is unrelated to the module root (mirrors global CLI → nested core geometry).

- Tests — deflake packaged prompt cwd test
  - Consolidated the cwd-resilience check into `src/stan/module.test.ts` and removed the standalone `src/stan/module.cwd.test.ts` to avoid cross-file parallel interference on `dist/stan.system.md`.
  - Ensures the two related assertions run sequentially within one spec, eliminating the race.

- Interop (stan-cli) — facet overlay feedback
  - Posted `.stan/interop/stan-cli/20251017-170900Z-facet-overlay-response.md` with core feedback.
  - Proposed a minimal engine hook: add `anchors?: string[]` (high-precedence allowlist) to core selection surfaces so anchors re-include over repo/overlay excludes while still respecting reserved denials.
  - Optional helper: export a small glob matcher to let CLI preview plan details with engine-parity semantics (nice-to-have).
  - Leaves overlay ownership in CLI; core remains presentation-free.

---

## Completed (recent)

- Interop (stan-cli) — overlay archive metadata contract
  - Posted `.stan/interop/stan-cli/20251017-173000Z-overlay-metadata-contract.md` specifying CLI responsibility and the JSON shape/semantics for the `overlay` block in `<stanPath>/system/.docs.meta.json`. Aligns plan output with the archived, machine-readable view used by the last run.

- Core — implemented anchors channel in selection surfaces
  - `filterFiles` accepts `anchors?: string[]` and re‑includes matches after excludes/.gitignore while respecting reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`) and output exclusion when `includeOutputDir=false`.
  - `createArchive`, `createArchiveDiff`, and `writeArchiveSnapshot` accept/propagate `anchors` to ensure consistent selection across full, diff, and snapshot.
  - Tests:
    - Re‑inclusion over excludes and `.gitignore` validated.
    - Anchors blocked by reserved paths and output exclusion validated.
  - Behavior is backward‑compatible when `anchors` is omitted/empty; archives remain unchanged unless anchors are provided.

- Core — helper + docs for facets overlay
  - Exported `makeGlobMatcher(patterns: string[]): (rel: string) => boolean` in `src/stan/fs/match.ts` and re-exported via the public barrel.
  - Tests: `src/stan/fs.match.test.ts` asserting prefix/glob/dotfile and normalization semantics (engine-parity).
  - README updated with a concise “Selection precedence and anchors” section covering includes/excludes/anchors and reserved denials.
  - Notes:
    - Helper is optional for consumers; CLI can use it to preview plan details without re‑implementing matcher semantics.
    - No behavior change to selection unless callers opt in to anchors; back‑compat preserved.

- Config tests — strict engine loader follow‑through
  - Added `src/stan/config.strict-schema.test.ts`:
    - Verifies that unknown keys inside the top‑level `stan-core` block are rejected by the strict Zod schema.
    - Confirms that the “missing stan-core section” error for JSON includes the path `stan.config.json` in the message (friendly diagnostics).
  - Keeps strictness scoped to `stan-core`; unknown keys outside `stan-core` remain tolerated by the engine.

- DRY test scaffolding — helpers
  - Added `writeStanConfigYaml/Json` utilities in `src/test/helpers.ts` for concise, namespaced config materialization in tests.
  - Added `withMockTarCapture` to centralize `tar.create` mocking and call capture for archive/diff tests.
  - Adoption plan:
    - Migrate existing suites incrementally to use these helpers (starting with archive/diff suites).
    - Keep changes local to test code; no production behavior changes.

- Tests — adopt shared tar capture helper in archive/diff suites
  - Replaced ad‑hoc vi.mock('tar') blocks with the shared `withMockTarCapture` in:
    - `src/stan/archive.test.ts`
    - `src/stan/archive.classifier.behavior.test.ts`
    - `src/stan/diff.combine.behavior.test.ts`
    - `src/stan/run.combine.archive.behavior.test.ts`
    - `src/stan/diff.classifier.behavior.test.ts`
  - No production behavior changes; keeps test setup concise and uniform.

- Tests — fix tar mock hoisting in withMockTarCapture
  - Resolved ReferenceError in archive/diff suites by avoiding closure capture inside a hoisted vi.mock factory.
  - Introduced a hoisted `state.body` and updated the mock to write that content; the helper now sets `state.body` per suite.
  - Restores passing behavior for archive/diff tests that rely on the tar mock writing deterministic output.

- Tests — adopt writeStanConfigYaml in config suites
  - Replaced ad‑hoc config materialization with `writeStanConfigYaml` in:
    - `src/stan/config.discover.test.ts`
    - `src/stan/config.load.extra.test.ts` (valid YAML case)
    - `src/stan/config.test.ts` (YAML case)
  - Negative‑path tests (unknown keys/missing section) remain manual to assert error behavior.
  - No production behavior changes; improves test clarity and reduces duplication.

  - Follow‑through: completed helper adoption for the above suites in this change set.

- Docs — add Typedoc examples for anchors parameter
  - Added @example snippets to:
    - `createArchive` (src/stan/archive.ts)
    - `writeArchiveSnapshot` and `createArchiveDiff` (src/stan/diff.ts)
    - `filterFiles` options (src/stan/fs.ts)
  - Clarifies anchor precedence and usage; code behavior unchanged.
