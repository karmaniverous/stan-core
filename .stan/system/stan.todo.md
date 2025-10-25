# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Optional DRY set (later)
  - Hoist additional small shared helpers if duplication appears during future work or CLI alignment.
  - Keep modules ≤ 300 LOC.

---

## Completed (recent)

- Docs — add Typedoc examples for anchors parameter
  - Added @example snippets to:
    - `createArchive` (src/stan/archive.ts)
    - `writeArchiveSnapshot` and `createArchiveDiff` (src/stan/diff.ts)
    - `filterFiles` options (src/stan/fs.ts)
  - Clarifies anchor precedence and usage; code behavior unchanged.

- Tests — adopt writeStanConfigYaml in config suites
  - Replaced ad‑hoc config materialization with `writeStanConfigYaml` in:
    - `src/stan/config.discover.test.ts`
    - `src/stan/config.load.extra.test.ts` (valid YAML case)
    - `src/stan/config.test.ts` (YAML case)
  - Negative‑path tests (unknown keys/missing section) remain manual to assert error behavior. No production behavior changes.

- Tests — fix tar mock hoisting in withMockTarCapture
  - Resolved ReferenceError by avoiding closure capture inside a hoisted vi.mock factory.
  - Introduced a hoisted `state.body` and updated the mock to write that content; the helper now sets `state.body` per suite.

- Tests — adopt shared tar capture helper in archive/diff suites
  - Replaced ad‑hoc vi.mock('tar') blocks with the shared `withMockTarCapture` in:
    - `src/stan/archive.test.ts`
    - `src/stan/archive.classifier.behavior.test.ts`
    - `src/stan/diff.combine.behavior.test.ts`
    - `src/stan/run.combine.archive.behavior.test.ts`
    - `src/stan/diff.classifier.behavior.test.ts`
  - No production behavior changes; keeps test setup concise and uniform.

- Core — helper + docs for facets overlay
  - Exported `makeGlobMatcher(patterns: string[]): (rel: string) => boolean` and documented selection precedence (includes/excludes/anchors and reserved denials) in README for engine‑parity matching.

- Core — implemented anchors channel in selection surfaces
  - `filterFiles` accepts `anchors?: string[]` and re‑includes matches after excludes/.gitignore while respecting reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`) and output exclusion when `includeOutputDir=false`.
  - `createArchive`, `createArchiveDiff`, and `writeArchiveSnapshot` accept and propagate `anchors` to ensure consistent selection across full, diff, and snapshot.

- System — stanPath discipline (prompt update)
  - Added a new system part that requires resolving `stanPath` from repo config or observed layout before composing patches.
  - Hard rules:
    - Always write under the resolved workspace (`/<stanPath>/…`).
    - Never leave `<stanPath>` as a literal in patch targets.
    - Reject mismatched `stan/…` vs `.stan/…` prefixes at pre‑send validation.
  - Purpose: eliminate misdirected writes to `stan/` when the repo uses `.stan/` (or vice‑versa); keep patch paths POSIX repo‑relative.

- System — facet‑aware editing guard (prompt update)
  - Added a new system part describing a two‑turn cadence when a target lies under an inactive facet:
    - Turn N: enable the facet (state patch) and log intent; no content patch for hidden targets.
    - Turn N+1: emit the actual edits after re‑run with `-f <facet>` (or `-F` to disable overlay).
  - Clarifies allowed mixing (other visible patches OK; anchors OK) and reiterates reserved denials.

- System — dev plan “Completed” enforcement (pre‑send validator)
  - Response Format now includes a hard pre‑send check that:
    - keeps “Completed” as the final major section,
    - allows only end‑append changes (no edits/insertions/re‑ordering of existing items),
    - requires corrections as a new “Amendment:” entry appended at the bottom.
  - Purpose: preserve append‑only history and prevent accidental churn in prior Completed items.

- Tooling — migrate ESLint config to typed flat TS
  - Replaced `eslint.config.js` with `eslint.config.ts` using typed `Linter.FlatConfig[]`.
  - Adopted `typescript-eslint` strictTypeChecked with `project: ['./tsconfig.json']` and `tsconfigRootDir` for type-aware linting.
  - Preserved Prettier integration (`eslint-config-prettier` `eslint-plugin-prettier`), simple-import-sort, and TSDoc rules.
  - Kept Vitest test rules and JSONC linting.
  - No behavior change expected; flat config remains the single source of truth for ESLint.

- Amendment: ESLint TS config typing and rule parity
  - Switched to `typescript-eslint` recommendedTypeChecked (avoid stricter rules).
  - Added a dedicated src/\*\* override with `parser` and `project` for type-aware linting.
  - Cast ecosystem plugin/config types as needed; added `@humanwhocodes/momoa` for JSONC types.
  - Kept Prettier + simple-import-sort + tsdoc; disabled stricter rules to match prior behavior.

- Amendment: ESLint typing — scope presets to TS and shim momoa
  - Scoped `typescript-eslint` presets to `src/**` so typed rules do not run on JSON files.
  - Kept a TS override with `parserOptions.project` for type-aware linting.
  - Imported `FlatConfig`/`Plugin` from `@eslint/core` and cast plugins accordingly.
  - Added `types/momoa.d.ts` ambient module and removed the unused `@humanwhocodes/momoa` devDependency (silences knip and TS7016).

- Amendment: ESLint typing — drop @eslint/core types and relax lib checks
  - Removed explicit `@eslint/core` type imports; the config is now untyped at the boundary to avoid cross‑package type drift.
  - Kept tseslint presets scoped to TS files and the project‑aware override; rule set unchanged.
  - Enabled `skipLibCheck` to avoid third‑party d.ts friction (e.g., eslint‑plugin‑jsonc generics) during typecheck/build/docs.

- Lint — enforce strict typed ESLint across all TS (including tests)
  - Adopted typescript-eslint strictTypeChecked presets for TS files.
  - Removed test‑only rule relaxations; tests now meet the same standard as other code.
  - Recorded “never disable a lint rule without prior discussion” in the project prompt.

- Lint — strict typed ESLint conformance across code and tests
  - Removed unused test type aliases/imports; replaced async mocks with explicit Promises to satisfy require-await.
  - Eliminated unnecessary `String()` conversions and nullish chains; narrowed types instead.
  - Addressed `restrict-template-expressions` byrefactor(lint): finalize strict typed ESLint in validator

When: 2025-10-24 Why: Resolve the final @typescript-eslint/no-unnecessary-condition error without disabling rules; tests must meet the same standard. What changed:

- src/stan/validate/response.ts: remove an unnecessary falsy guard in the commit-position check; use non-null assertion and compare kind directly.
- .stan/system/stan.todo.md: append Completed entry documenting the final strict typed ESLint cleanup in the validator. stringifying numeric values in diagnostics.
  - Refactored size stat/read logic to avoid optional chains; adjusted regex closing-fence logic to stringify tick counts.
  - No rule disables introduced; tests meet the same lint standard as source.

- Lint — finish strict type-aware ESLint cleanup (no-unnecessary-condition group)
  - Removed unreachable conditional in imports staging (string-only globs).
  - Replaced redundant 'mkdirp' equality with final else in file-ops executor.
  - Dropped nullish coalescing on guaranteed strings (format/response).
  - Kept tests and source under the same lint standard; no rule disables added.

- Lint — finalize strict typed ESLint in validator (commit position check)
  - Removed an unnecessary falsy guard; use non‑null assertion for the final block and compare kind directly.
  - No rule disables introduced; tests continue to meet the same standard as source.

- Tests — SSR-safe import for makeStanDirs in fs.ts
  - Replaced the static named import with a dynamic accessor and local fallback in src/stan/fs.ts to avoid a Vitest 4 SSR edge case where `makeStanDirs` was undefined in combine-behavior tests.
  - Restores green on src/stan/diff.combine.behavior.test.ts; no runtime behavior change.
  - Touch points:
    - src/stan/fs.ts — dynamic import fallbackMakeStanDirs
    - Documentation: this entry

- Tests — SSR import stabilization for createArchiveDiff
  - In src/stan/run.combine.archive.behavior.test.ts, switch to a dynamic import of ./diff inside the failing test to avoid a Vitest 4 SSR named-export binding glitch that surfaced “createArchiveDiff is not a function”.
  - Aligns with prior SSR-safe patterns; no runtime behavior change.
  - Expect green on the remaining combine-behavior suite.

- Core — DRY makeStanDirs usage (remove local fallback)
  - Added a default export to src/stan/paths.ts so SSR can resolve makeStanDirs via either named or default export.
  - Removed the duplicated fallbackMakeStanDirs from src/stan/fs.ts; ensureStanWorkspace now resolves makeStanDirs with a dynamic import and falls back to the default export when needed.
  - Preserves Vitest SSR robustness without code duplication; no functional changes at runtime.

- Requirements — document SSR-friendly dynamic import pattern
  - Added a durable note to .stan/system/stan.requirements.md describing the named-or-default dynamic import pattern to keep Vitest SSR stable.
  - Includes a small example and guidance to prefer static imports unless dynamic resolution is required for test/SSR robustness.
  - No runtime behavior change; documentation only.

- Lint — integrate @vitest/eslint-plugin for tests
  - Move @vitest/eslint-plugin to devDependencies and enable vitest.configs.recommended in eslint.config.ts for \*.test.ts(x).
  - Keeps strict, type-aware linting and adds focused test rules without changing runtime behavior.
  - No code changes beyond lint configuration.

- Patch engine — preserve leading dot in “.stan/…” creation paths
  - Fixed path normalization in jsdiff fallback and last‑resort creation fallback to strip only a literal “./” and preserve “.stan/...”.
  - Added focused tests:
    - src/stan/patch/jsdiff.newfile.dotstan.test.ts
    - src/stan/patch/run/pipeline.creation.dotstan.test.ts
