# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Dependency graph mode (engine): stage external context under `.stan/context/**`
  - Wire staging + inclusion into the archive flow used by the CLI:
    - stage npm/abs nodes using resolved paths available during graph generation
    - validate staged bytes hash to `metadata.hash` (fail fast)
    - ensure archiving uses `anchors: ['.stan/context/**']` (context is gitignored)
  - Add support for staging only a selected nodeId set (state closure) to avoid bloat.

- Undo/redo validation seam (engine; CLI calls)
  - Provide a validation API to support strict undo/redo:
    - compute selected node set from restored meta+state
    - for npm nodes: locate `<pkg>@<ver>` candidates in current install and validate per-file sha256 against `metadata.hash`
    - for abs nodes: hash `locatorAbs` and compare to `metadata.hash`
    - fail fast with structured mismatches
  - Note: strict mismatch detection should fail even if cached archives contain older staged bytes (mismatch is environment incompatibility).

- Tests (engine)
  - Unit tests for:
    - state parsing + closure determinism (depth + edgeKinds + excludes)
    - nodeId normalization rules (npm + abs)
    - staging copies + hash verification (fixture trees)
    - undo validation mismatch cases (npm version/path mismatch; abs missing/mismatch)

- Optional DRY set (later)
  - Hoist additional small shared helpers if duplication appears during future work or CLI alignment.
  - Keep modules ≤ 300 LOC.

---

## Completed (recent)

- Test stability + lint config: classifier resolver and Prettier config
  - Resolved a Vitest SSR hazard by resolving `classifyForArchive` at action time using a named‑or‑default dynamic import pattern in both archive and diff paths.
  - Converted `eslint-config-prettier` to a static import in `eslint.config.ts` (no need for dynamic import).
  - Integrated an engine‑focused “SSR/ESM test‑stability” section into the project prompt to codify these patterns.
  - Outcome: fixes “classifyForArchive is not a function” in `src/stan/archive.test.ts`; preserves runtime behavior; keeps engine presentation‑free.

- Patch engine — preserve leading dot in “.stan/…” creation paths
  - Fixed path normalization in jsdiff fallback and last‑resort creation fallback to strip only a literal “./” and preserve “.stan/...”.
  - Added focused tests:
    - src/stan/patch/jsdiff.newfile.dotstan.test.ts
    - src/stan/patch/run/pipeline.creation.dotstan.test.ts

- Tests — fix helper import ambiguity in config discovery test
  - Replaced the helper import with a local YAML write in src/stan/config.discover.test.ts to avoid an intermittent SSR import ambiguity under Vitest. Test intent and behavior unchanged; resolves the single failing test.

- Amendment: config discovery test — use writeFile directly
  - Replaced the undefined helper call with a direct writeFile in src/stan/config.discover.test.ts to fix TS2304 and lint errors.
  - No change in test intent; stabilizes typecheck/lint/build.

- Tests — stabilize SSR-sensitive imports in two suites
  - src/stan/archive.classifier.behavior.test.ts: dynamically import the tar mock helper inside beforeEach and reset captured calls there.
  - src/stan/patch/jsdiff.newfile.nested.test.ts: dynamically import applyWithJsDiff inside the test body to avoid cross‑suite mock effects.

- Docs: add “STAN assistant guide” upkeep policy
  - Added a system-prompt policy requiring a self-contained assistant guide doc (default `guides/stan-assistant-guide.md`, unless project prompt specifies a different stable path) and keeping it updated alongside API/semantic changes.

- Docs: create initial STAN assistant guide
  - Added `guides/stan-assistant-guide.md` describing how to configure and use the stan-core engine APIs (config, selection, archive/diff/snapshot, imports staging, patch pipeline, and response validation).

- Tests: hoist SSR-fragile exports used by archiving
  - Converted exported const-arrow bindings to function declarations for:
    - makeStanDirs (paths)
    - createArchive (archive)
    - writeArchiveSnapshot/createArchiveDiff (diff)
  - Goal: eliminate Vitest SSR “is not a function” export binding failures.

- Tests: hoist remaining high-fanout exports
  - Hoisted classifyForArchive (classifier) to stop SSR “export not found” failures in archive tests.
  - Hoisted fs exports (listFiles/filterFiles/ensure\*) to stop SSR “is not a function” failures in fs-related tests and reduce follow-on flake risk.

- Docs + patch ingestion: default tilde fences (~~~~)
  - Updated system-prompt guidance to wrap all code blocks in tilde fences with default `~~~~`, bumping by 1 when inner content contains `~` runs.
  - Updated patch cleaner/extractor to accept both backtick and tilde fenced payloads, and added focused tests to prevent regressions.

- Patch ingestion: avoid false close on " ~~~~" context lines
  - Fixed unified-diff fence extraction to avoid treating diff context lines that start with a space as candidate closing fences (tilde and backtick).
  - Added a regression test and aligned remaining Response Format wording to the tilde fence hygiene rule.

- File Ops: implement cp
  - Added `cp <src> <dest>` support (recursive, no overwrite, creates parents), updated validation, and added execution coverage.

- Packaging: make the library ESM-only
  - Stop publishing `dist/cjs` and remove the `exports.require` condition.
  - Point `main` and `types` at the ESM build outputs.
  - Update README and the local assistant guide to avoid subpath imports and to explicitly document ESM-only usage.

- Docs: align requirements with ESM-only packaging
  - Update `.stan/system/stan.requirements.md` to reflect ESM-only outputs.

- Docs: specify dependency graph mode contracts
  - Added baseline system-prompt guidance for dependency graph mode and made `.stan/imports/**` read-only as a baseline rule.
  - Documented `archive.meta.tar` output and dependency artifacts under `.stan/context/` (meta + state + staged externals).

- Dependency graph mode: add schemas + closure primitives
  - Added strict Zod schemas and TS types for dependency meta/state formats:
    - `.stan/context/dependency.meta.json`
    - `.stan/context/dependency.state.json`
  - Implemented deterministic closure computation from meta+state (depth +
    edgeKinds; excludes win) with unit tests.
  - Exported these primitives from the engine barrel for downstream integration.

- Chore: fix Zod deprecated issue-code usage
  - Replaced deprecated `ZodIssueCode` constants with raw `"custom"` codes.

- Dependency graph mode: add meta archive support
  - Added `createMetaArchive(...)` to write `.stan/output/archive.meta.tar`
    (system files + `.stan/context/dependency.meta.json` only).
  - Excludes `.stan/system/.docs.meta.json`, dependency state, and staged
    payloads by omission.
  - Added a focused unit test to pin down archive selection behavior.

- Chore: fix meta archive test helper import
  - Corrected the test helper import path in `src/stan/archive/meta.test.ts`.

- Imports safety: enforce `<stanPath>/imports/**` read-only in patch + File Ops
  - Threaded `stanPath` through patch pipeline and jsdiff sandbox defaults so the engine can apply workspace-scoped protection rules.
  - Refused File Ops and unified diff targets that touch `<stanPath>/imports/**` when `stanPath` is provided (CLI will always provide it).
  - Added focused tests and updated the local assistant guide to document the safety net.

- Chore: fix imports-guard lint and test
  - src/stan/patch/run/pipeline.ts: remove unnecessary `??` on regex capture groups (eslint `no-unnecessary-condition`).
  - src/stan/patch/imports-policy.test.ts: create fixture parent dirs before writing into `.stan/imports/...`.

- Dependency graph mode: build + write dependency.meta.json
  - Added a context-mode API that dynamically imports TypeScript and stan-context only when invoked, and throws with clear errors if missing.
  - Implemented deterministic normalization for external nodes:
    - npm externals -> `.stan/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
    - abs externals -> `.stan/context/abs/<sha256(locatorAbs)>/<basename>` with `locatorAbs` stored for future strict undo validation
  - Omitted builtin and missing/unresolved nodes from persisted meta, surfacing them as warnings instead.
  - Added focused unit tests and updated the local assistant guide.

- Chore: remove shim; fix context-mode lint
  - Installed `@karmaniverous/stan-context` as a devDependency and removed the local type shim.
  - Refactored dependency meta builder helpers into small modules to keep files under the 300-LOC cap and satisfy strict ESLint rules.
  - Fixed lint in context tests (no conditional expect; no unsafe return).

- Lint: fix build.ts unnecessary condition checks
  - Fixed two `@typescript-eslint/no-unnecessary-condition` errors in
    `src/stan/context/build.ts` by tightening types and using `Array#at(-1)`.

- Typecheck: restore sources Record typing
  - Fixed TS2322 in `src/stan/context/build.ts` by keeping `sources` typed as a
    `Record<string, NodeSource>` and gating lookups with `hasOwnProperty`.

- Dependency graph mode: stage external context bytes
  - Added `stageDependencyContext(...)` to copy and sha256-verify external node
    bytes into `.stan/context/{npm,abs}/...` for archiving.
  - Added focused unit tests and documented the staging step in the assistant guide.