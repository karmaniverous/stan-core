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
  - Added a dedicated src/** override with `parser` and `project` for type-aware linting.
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