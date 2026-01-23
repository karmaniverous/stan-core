# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Context mode (`--context`) allowlist archiving + budgeting tooling
  - Implement allowlist-only archive selection in context mode:
    - Archive payload = Base + selected dependency closure (repo-local nodeIds + staged externals) with reserved denials and binary exclusion always enforced.
    - Base is config-driven and aligns with meta archive contents (system docs + dependency meta + repo-root base files per selection config + dependency state when present).
    - Explicit `excludes` are hard denials across base and closure; explicit selection may override `.gitignore` but must not override excludes/reserved.
  - Enforce dependency state updates in dependency graph mode:
    - In dependency mode, patch-carrying replies must include either:
      - a Patch for `.stan/context/dependency.state.json`, or
      - a bullet line `dependency.state.json: no change` under `## Input Data Changes` (and no state patch).
    - Forbid no-op state patches (do not emit a state patch unless it changes content).
    - Update the response validator to enforce this in context mode (likely via an option/flag passed by stan-cli).
  - Deterministic budgeting support (open questions / design work):
    - Add tooling output that computes the selected closure membership and estimated size so assistants can follow the 50%/65% budgeting heuristic deterministically.
    - Decide where this computation lives (stan-core vs stan-cli) and what artifact to emit (e.g., JSON + human-readable summary under `.stan/output/` and/or `.stan/context/`).
    - Decide what the report must contain at minimum:
      - selected node count,
      - sum of `metadata.size` bytes (bytes as proxy for chars),
      - token estimate (`bytes/4`),
      - top-N largest contributors,
      - and prune suggestions ordered by the deterministic prune ladder.
    - Decide how the report handles “base bytes” vs “closure bytes” vs “external staged bytes”.

- Docs hygiene (release readiness)
  - Eliminate TypeDoc warnings by ensuring all referenced public types/schemas are exported in the public surface.
  - Re-run `npm run docs` and confirm 0 warnings.

- Dependency graph quality (module descriptions)
  - Roll out a module-head TSDoc block (`@module` or `@packageDocumentation`) for every code module, optimized for the first 160 characters.
  - ESLint enforcement is wired at warn-level initially; promote to error once the repository is compliant.

- Long-file cap compliance (≤ 300 LOC per module)
  - Identify and decompose any TS modules > 300 LOC before further edits.
  - Current known long file:
    - `src/stan/context/validate.ts` (must be split into smaller modules while keeping the public API stable)

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
  - Implemented deterministic closure computation from meta+state (depth + edgeKinds; excludes win) with unit tests.
  - Exported these primitives from the engine barrel for downstream integration.

- Chore: fix Zod deprecated issue-code usage
  - Replaced deprecated `ZodIssueCode` constants with raw `"custom"` codes.

- Dependency graph mode: add meta archive support
  - Added `createMetaArchive(...)` to write `.stan/output/archive.meta.tar` (system files + `.stan/context/dependency.meta.json` only).
  - Excludes `.stan/system/.docs.meta.json`, dependency state, and staged payloads by omission.
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
  - Fixed two `@typescript-eslint/no-unnecessary-condition` errors in `src/stan/context/build.ts` by tightening types and using `Array#at(-1)`.

- Typecheck: restore sources Record typing
  - Fixed TS2322 in `src/stan/context/build.ts` by keeping `sources` typed as a `Record<string, NodeSource>` and gating lookups with `hasOwnProperty`.

- Dependency graph mode: stage external context bytes
  - Added `stageDependencyContext(...)` to copy and sha256-verify external node bytes into `.stan/context/{npm,abs}/...` for archiving.
  - Added focused unit tests and documented the staging step in the assistant guide.

- Lint: fix stageDependencyContext unnecessary-condition
  - Adjusted `stageDependencyContext` meta typing and guards to satisfy `@typescript-eslint/no-unnecessary-condition` without changing behavior.

- Dependency graph mode: wire staging into archive flow
  - Added archive-flow helpers that stage selected external context (from dependency state closure when provided) and force archive inclusion via `anchors: ['.stan/context/**']` so gitignored context is still archived.
  - Added a focused test and documented the wrapper APIs in the assistant guide.

- Fix: archive-flow test + lint hygiene
  - Fixed the archive-flow test helper import path and removed `any`-typed dynamic import usage; also cleaned up redundant/unused types in `src/stan/context/archive-flow.ts`.

- Dependency graph mode: strict undo validation seam
  - Added `validateDependencySelection(...)` to validate selected external dependency nodes against the current environment (npm package@version and abs locator hash checks) and fail fast on mismatches.
  - Added focused unit tests and documented the API in the assistant guide.

- Fix: strict undo validation test + lint
  - Removed an unused local in `validateDependencySelectionOrThrow`.
  - Adjusted the abs mismatch test fixture to keep size constant so the mismatch reason is deterministically `hash-mismatch`.

- CI green: validate seam fixes confirmed
  - `lint`, `typecheck`, and `test` all pass after the undo validation fixes.

- Release readiness: ran build/docs/knip checks
  - `npm run build` succeeded (Rollup warnings observed; output produced).
  - `npm run docs` produced warnings to address (TypeDoc “referenced but not included” items).
  - `npm run knip` reported only the expected optional peerDependency reference.

- Policy: module docs + TypeDoc/DX guidance
  - Added system-prompt guidance to require module-head `@module`/`@packageDocumentation` docblocks and to optimize the first 160 chars for dependency-graph selection.
  - Added generic policies for doc formatting (no manual hard-wrap), TypeScript DX/inference, and TypeDoc/TSDoc coverage.
  - Wired the stan-context ESLint rule at warn-level to start enforcement without breaking CI; plan to promote to error after rollout.
- Lint/docs: module docblock formatting rule
  - Documented the required module docblock structure (multi-line JSDoc, tag after prose, wrap code comments at 80) and began applying it to core engine modules without disabling `stan-context/require-module-description`.
- Docs: clarify module docblock merge behavior (tag last)
- Lint: silence module-doc warnings for tests; fix runtime modules
- Policy: module docblocks required except tests
  - Updated system-prompt baseline: module headers required everywhere except tests (standard test-like patterns are exempt).
  - Added missing module docblocks in `src/stan/patch/detect.ts` and `src/stan/patch/jsdiff.ts` to clear `stan-context/require-module-description` warnings.
- Policy: context-mode allowlist archiving requirements
  - Recorded `--context` allowlist-only archiving semantics, config-driven Base definition, budgeting heuristic (50% target, 65% max), and dependency.state.json update enforcement in `.stan/system/stan.requirements.md`.
  - Added a system-prompt policy to hoist policy-bearing magic numbers/strings into feature-scoped constants modules.
- System prompt: adopt scratch memory; remove handoff
- Interop: request stan-context confirm `metadata.size` semantics
  - Posted an interop request to stan-context clarifying that `dependency.meta.json` node `metadata.size` must be bytes (used as a proxy for characters for deterministic budgeting via `bytes/4`).
  - This supports `--context` allowlist-only archiving and budget-driven selection without reading all file bodies.
- Interop: request selection summary helper in stan-context
  - Posted a follow-up interop request proposing an exported helper to compute dependency state closure membership and aggregate byte sizing from the existing graph.
  - This avoids bloating `dependency.meta.json` with per-node transitive summaries while enabling deterministic selection reports downstream.
- Prompt/requirements: remove facets/anchors; tighten precedence
- Remove anchors from engine API + docs
  - Removed `anchors` from selection/archiving APIs and updated docs/tests to use `includes` (override `.gitignore`) with `excludes` as hard denials.
- Context mode: start allowlist-only archiving + enforcement seam
  - Added allowlist-based full+diff archivers and a context allowlist planner (Base + dependency closure) with explicit excludes as hard denials and reserved denials enforced.
  - Extended `archive.meta.tar` to include repo-root base files and `dependency.state.json` when present (still excludes staged payloads and `.docs.meta.json`).
  - Added dependency-mode option to the response validator to require either a `dependency.state.json` patch or the exact “dependency.state.json: no change” signal and to reject no-op state patches.
- Fix: context allowlist lint hygiene
  - Removed redundant `unknown | null` unions that tripped `@typescript-eslint/no-redundant-type-constituents`.
  - Adjusted TSDoc text to avoid unescaped `{}` braces so `tsdoc/syntax` does not warn.