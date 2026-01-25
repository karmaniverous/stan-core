# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Breaking: adopt dependency context meta/state v2 (compact) end-to-end
  - Switch assistant-facing `.stan/context/dependency.meta.json` and `.stan/context/dependency.state.json` to v2 compact formats (nodeId = archive address; externals normalized to staged `.stan/context/**` paths).
  - Use stan-context `summarizeDependencySelection` for closure + deterministic byte sizing.
  - Accept integrity checks as `size` + 128-bit sha256 prefix (base64url, no padding); remove persisted absolute locators from assistant-facing meta/state.
  - Coordinate stan-cli + stan-context releases and update docs + system prompt parts in lockstep.

- Context mode (`--context`) follow-through: stan-cli wiring
  - Coordinate with stan-cli to consume `onSelectionReport` from stan-core during run/snap/context flows (presentation only; no engine output files).
  - Keep the report deterministic and small (counts/options/snapshot + classifier summary); rely on `onArchiveWarnings` for detailed file lists.

- Docs hygiene (release readiness)
  - Eliminate TypeDoc warnings by ensuring all referenced public types/schemas are exported in the public surface.
  - Keep `typedoc --emit none` at 0 warnings; when warnings appear, fix them in small slices and export any referenced public types.

- Dependency graph quality (module descriptions)
  - Roll out a module-head TSDoc block (`@module` or `@packageDocumentation`) for every code module, optimized for the first 160 characters.
  - ESLint enforcement is wired at warn-level initially; promote to error once the repository is compliant.

- Long-file cap compliance (≤ 300 LOC per module)
  - Identify and decompose any TS modules > 300 LOC before further edits.
  - After each refactor, re-scan for any remaining modules > 300 LOC before making further changes.

- Optional DRY set (later)
  - Hoist additional small shared helpers if duplication appears during future work or CLI alignment.
  - Keep modules ≤ 300 LOC.

---

## Completed (recent)

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
- Context mode: add deterministic sizing helper
  - Added `summarizeContextAllowlistBudget(...)` to compute total bytes and a `bytes/4` estimate for a computed allowlist plan.
  - Report includes base/closure breakdown and largest entries, using meta sizes when available and falling back to stat for repo files.
- Fix: budget helper lint + typecheck
  - Removed an unnecessary optional chain in `budget.ts` and guarded meta lookups with `hasOwnProperty` for correctness.
  - Updated `budget.test.ts` to avoid readonly tuple arrays and to pass a properly typed `meta.nodes` shape.
- Docs: align dev plan and scratch with green checks
- Docs: fix TypeDoc warnings (budget params + exported option types)
- Docs: export allowlist archive options for TypeDoc
- Amendment: `npm run docs` now reports 0 warnings; treat “Docs hygiene (release readiness)” as currently satisfied and focus follow-through on context-mode selection reporting + CLI wiring.
- Design: lock stan-core selection report contract (data-only callback; no engine IO); implement next thread.
- Implement selection report callbacks on archive APIs (data-only; no IO).
- Fix typecheck/lint in selection-report tests (avoid TS narrowing to null).
- Fix type narrowing for diff selection report test (kind guard).
- Docs: export SelectionReportCounts
  - Re-exported `SelectionReportCounts` from `src/stan/index.ts` so TypeDoc includes it when referenced by `SelectionReport.counts`.
  - Intended outcome: `typedoc --emit none` reports 0 warnings.
- Amendment: TypeDoc is clean again
  - Confirmed `typedoc --emit none` reports 0 warnings after exporting `SelectionReportCounts`.
  - Follow-through focus returns to stan-cli wiring for selection report presentation.
- Docs: system prompt parts hygiene
  - Unwrapped invalid hard wraps across `.stan/system/parts/*.md` to comply with the repo’s “no manual hard-wrap” Markdown policy.
  - Removed tar header/byte-count integrity verification as an assistant obligation (the assistant must not claim tar-level integrity checks without explicit tool output).
  - Removed references to validators/tools from the system prompt text and clarified that dev plan append-only is scoped to the Completed section.
- Docs: consolidate prompt parts; drop anchors/facets
  - Memorialized the File Ops “fenced for display, copied without fence markers” convention in `.stan/system/stan.project.md`.
  - Consolidated duplicated rule blocks across `.stan/system/parts/*.md` to reduce drift and keep the monolith lean.
  - Clarified dev plan pruning: keep `.stan/system/stan.todo.md` under 300 lines by pruning whole oldest Completed entries (do not rewrite retained entries).
- Docs: align user-facing docs with current engine behavior
  - Updated README + `guides/stan-assistant-guide.md` to reflect current selection/archiving semantics (includes/excludes; no anchors API; meta archive includes dependency state when present).
  - Corrected TypeDoc/JSDoc comments that drifted from implementation (no “patch included in archives”; no “anchors” options).
  - Documented current File Ops verbs (including `cp`) and imports read-only enforcement.
- Docs: remove remaining anchors/meta drift
  - Fixed `src/stan/diff.ts` TSDoc to reflect actual `includes`/`excludes` semantics (includes are additive; excludes win).
  - Updated `guides/stan-assistant-guide.md` to match current `archive.meta.tar` behavior (includes dependency state when present; excludes staged payloads by omission).
  - Removed remaining “anchors” references in `.stan/system/stan.requirements.md` that no longer reflect the engine API.
- Docs: align meta archive docs with current behavior
  - Updated `src/stan/archive/meta.ts` module doc comment to match implementation (optional dependency state + repo-root base files; staged payloads excluded by omission).
  - Updated `.stan/system/parts/240-dependency-graph-mode.md` and regenerated `.stan/system/stan.system.md` to reflect that meta archives include dependency state when present.
- Refactor: split dependency selection validator into modules
  - Replaced `src/stan/context/validate.ts` with a small orchestrator and moved implementation into `src/stan/context/validate/**` (npm/abs/path/hash/types).
  - Intended outcome: satisfy the ≤300 LOC module cap while keeping the public API stable (`validateDependencySelection*` exports unchanged).
- Lint: fix tsdoc/syntax warnings in validate modules
  - Escaped `@` in TSDoc prose (`pkg\@version`, `package\@version`) to satisfy `eslint-plugin-tsdoc` and keep lint clean.
- Docs: retire “swappable core” concept
  - Removed the swappable-core requirement section and dropped `--core` references from project-level prompt guidance.
  - Keep stan-core framed as a presentation-free engine/library without “swappable core” positioning.
- Refactor: DRY SSR resolver + diff constants + test tmp helpers
  - Added a shared SSR-safe export resolver (`src/stan/util/ssr/resolve-export.ts`) and migrated archive/diff/fs call sites to use it.
  - Hoisted diff snapshot/sentinel filenames into `src/stan/diff/constants.ts` and deduplicated sha256 hashing via `src/stan/diff/hash.ts`.
  - Split vitest-free filesystem cleanup into `src/test/fs.ts`, added `src/test/tmp.ts`, and began a broad test sweep to standardize temp dir usage.
- Chore: fix lint + knip hygiene
  - Removed unused imports in tests and diff modules flagged by ESLint.
  - Adjusted `resolve-export` tests to avoid `require-await` violations.
  - Refactored `functionGuard` typing to avoid `Function` and satisfy strict lint rules; removed an unused helper file flagged by Knip.
- Fix: resolve-export lint errors (functionGuard)
  - Updated `functionGuard` to avoid the unsafe `Function` type and satisfy `no-unnecessary-type-parameters` without changing runtime behavior.
- Fix: resolve-export typecheck regression (strictFunctionTypes)
  - Adjusted the internal “any function” constraint to avoid parameter contravariance issues and restore `tsc` green.
- Chore: standardize remaining test temp-dir patterns
  - Replaced remaining direct `mkdtemp/rm` usage in tests with `makeTempDir`/`cleanupTempDir` from `src/test/tmp.ts`.
  - Ensures consistent cleanup and reduces Windows EBUSY/ENOTEMPTY flake risk.
- System prompt: do not reinvent the wheel
  - Added a system-level directive to prefer established, type-safe, tree-shakable dependencies (e.g., radash, zod) over home-grown solutions to well-traveled problems.
- Refactor: use radash for uniq+sort helpers
  - Added a small shared helper (`src/stan/util/array/uniq.ts`) backed by Radash `unique` and migrated repeated “uniq + sorted strings” patterns to it in allowlist/context modules.
  - Added focused unit coverage for the new helper.
- Refactor: remove leftover uniqSorted in ctx allowlist
  - Removed the remaining local `uniqSorted` helper in `src/stan/context/allowlist.ts`.
  - Standardized stage node ID sorting on the shared Radash-backed helper to keep semantics uniform and deterministic.
- Refactor: use uniqSortedStrings in context helpers
  - `src/stan/context/archive-flow.ts`: replaced local Set-based `uniq` with shared `uniqSortedStrings` for deterministic include/stage lists.
  - `src/stan/context/state.ts`: replaced local Set+sort helper with shared `uniqSortedStrings`.
  - `src/stan/context/validate/npm.ts`: replaced Set+sort root de-dupe with `uniqSortedStrings`.

- Refactor: consolidate path helpers in context modules
  - Replaced duplicated `toPosix`, `normalizePrefix`, and `isUnder` implementations in `src/stan/context/allowlist.ts`, `archive-flow.ts`, `budget.ts`, and `stage.ts` with imports from `src/stan/path/repo.ts` and `src/stan/path/prefix.ts`.
  - Verified that `repo.toPosix` (which strips leading `./`) is safe for the affected use cases (node IDs, glob matching, and `stageRootFor`).

- DRY follow-through: test temp-dirs + path helpers
  - Standardized test temp-dir usage across the codebase to use `src/test/tmp.ts` (`makeTempDir`/`cleanupTempDir`).
  - Consolidated `matchesPrefix`/`isUnder` logic in `src/stan/fs.ts`, `src/stan/fs/match.ts`, and `src/stan/fs/reserved.ts` to use shared `@/stan/path/prefix`.

- Fix: resolve reference error in match.ts refactor
  - Corrected `src/stan/fs/match.ts` to call `normalizePrefix` instead of the removed local `normalize` helper inside `makeGlobMatcher`.
  - Verified unit tests (`src/stan/fs.match.test.ts`) now pass.

- Docs: apply module docblocks to root tools/configs
  - Added/converted `@module` docblocks for `tools/gen-system.ts`, `rollup.config.ts`, and `vitest.config.ts`.
  - Ensures compliance with dependency graph quality rules for non-test code files.

- Refactor: decompose response validator (long-file compliance)
  - Split `src/stan/validate/response.ts` (approx 350 lines) into:
    - `types.ts`, `blocks.ts`, `validate.ts`, `index.ts`.
  - Preserved public API surface in `index.ts` so imports in `src/stan/index.ts` remain valid (Node resolution handles directory index).
  - Updated tests to import from `validate.ts` (internal) or index as appropriate.

- Fix: restore dependency mode validation logic
  - Restored the "missing state patch vs no-change signal" check in `src/stan/validate/response/validate.ts`.
  - Resolved lint error (unused import `extractH2SectionBody`) and fixed the failing dependency-mode test.

- Refactor: decompose File Ops module (long-file compliance)
  - Split `src/stan/patch/file-ops.ts` (approx 23KB) into `types.ts`, `parse.ts`, `exec.ts`, and `index.ts`.
  - Updated tests to import from the decomposed modules.
  - Maintains public API compatibility via `index.ts` re-exports.

- Refactor: decompose build module (long-file compliance)
  - Split `src/stan/context/build.ts` (approx 22KB) into `types.ts`, `graph.ts`, `normalize.ts`, and `index.ts`.
  - Updated `build.test.ts` imports.
  - Maintains public API compatibility via `index.ts` re-exports.

- Fix: resolve context build test and lint errors
  - Corrected test import path (`../../test/tmp` -> `../../../test/tmp`) in `src/stan/context/build/build.test.ts`.
  - Resolved TSDoc syntax warning in `graph.ts` and unnecessary optional chain in `normalize.ts`.

- Fix: resolve context build lint (strict null checks)
  - Removed unnecessary optional chain in `build.test.ts` and unnecessary truthiness check in `normalize.ts` to satisfy strict ESLint rules.
  - `Record` lookups are typed as non-undefined in this config, so explicit checks were flagged.

- Prompt: enforce scratch checklist + code-quality guardrails
  - Updated Response Format post-compose checklist to require a Patch for `<stanPath>/system/stan.scratch.md` whenever any Patch blocks are present (interop request from stan-cli).
  - Strengthened system-level guidance to avoid `any` and avoid `eslint-disable` without a prior design discussion and inline rationale.
  - Clarified in `.stan/system/stan.project.md` that “update system prompt” means updating `.stan/system/parts/*.md` and regenerating the monolith.

- Interop: request TS injection support in stan-context
  - Posted an outgoing interop note to stan-context proposing a host-provided TypeScript entrypoint path/provider option for `generateDependencyGraph`.
  - Intended outcome: eliminate brittle ambient TS resolution from bundled outputs and make stan-cli context mode “just work” without repo-local installs.

- Context mode DX: pass through TS injection to stan-context
  - Removed stan-core’s direct TypeScript import/gate for dependency graph mode; stan-core now delegates TS availability to stan-context.
  - Extended `buildDependencyMeta` args to accept `typescript` and `typescriptPath` (host-provided) and pass them through to `generateDependencyGraph`.
  - Updated tests to assert pass-through behavior and to ensure missing-injection failures originate from stan-context (not a core-side gate).
  - Externalized `@karmaniverous/stan-context` in Rollup to prevent bundling and avoid runtime loader/resolution regressions.
  - Updated requirements/docs to reflect the new host-injection contract.

- Docs: clarify TypeScript injection contract in README
  - Documented that `buildDependencyMeta(...)` requires host-provided `typescript` or `typescriptPath`.
  - Clarified that stan-core does not resolve/import TypeScript; it passes through to stan-context and surfaces stan-context errors.

- Design: lock dependency context v2 direction
  - Confirmed the v2 model: nodeId is the archive address; externals are normalized to staged `.stan/context/**` paths; source locators are transient to `stan run -c`.
  - Next: implement v2 meta/state in stan-core and coordinate stan-cli + stan-context updates.