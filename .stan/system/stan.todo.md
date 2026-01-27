# STAN Development Plan

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Docs: update context budgeting policy
  - Replaced static "half context" rule with dynamic "half remaining" heuristic targeting diff size.
  - Updated `.stan/system/stan.requirements.md`.

- Docs: add context mode termination trigger
  - Added specific rule to request new thread when dependency state update is no longer feasible within budget.

- Docs: make dependency mode thread-sticky
  - Updated requirements to treat dependency mode as active if seen anywhere in the thread history.

- Docs: enforce File Ops fencing and discussion protocol
  - Updated system prompt parts to mandate tilde fences for File Ops.
  - Added "Discussion Protocol" for "discuss before implementing" triggers.

- Docs: refine protocol and hygiene
  - Clarified discussion protocol to wait for "actionable conclusion".
  - Added anti-pattern warning for unfenced File Ops.

- Meta archive flexibility (CLI alignment)
  - Update `createMetaArchive` to accept `fileName` option (default `archive.meta.tar`).
  - Allows `stan-cli -m` to write `archive.tar` directly.

- Context mode (`--context`) follow-through: stan-cli wiring
  - Coordinate with stan-cli to consume `onSelectionReport` from stan-core during run/snap/context flows (presentation only; no engine output files).
  - Keep the report deterministic and small (counts/options/snapshot + classifier summary); rely on `onArchiveWarnings` for detailed file lists.

- Docs: enforce editing safety and discovery protocol
  - Added "Load-Before-Edit" rule (critical) to prevent editing unloaded files.
  - Added "Discovery Protocol" for broad prompts.

- Docs: harden context budgeting
  - Elevated "Half Remaining" rule to CRITICAL status.
  - Required explicit size pre-computation before state updates.

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

- Design: host-private dependency.map.json; no hashes in assistant meta
  - Confirmed `dependency.meta.json` is assistant-facing and should omit content hashes to preserve context budget.
  - Confirmed `dependency.map.json` is host-private, regenerated each `stan run -c`, and is the source of truth for locatorAbs + full sha256 + size during staging verification.

- Design: lock archive composition rules for context + combine
  - Confirmed config `includes`/`excludes` are ignored for `.stan/**` paths (engine-owned selection under `stanPath`).
  - Confirmed `--context` threads start from FULL or META archives (never DIFF-only).
  - Confirmed `--context meta` omits dependency state always and includes `--combine` outputs (excluding known STAN archive files).
  - Confirmed config `excludes` are hard denials for dependency-selected repo paths outside `.stan/**`.

- Docs: capture v2 archive composition + next-thread plan
  - Updated scratch and requirements to record the locked v2 + combine + context META omission-of-state contract and the concrete Slice 1 implementation plan for the next thread.

- Context mode: engine-owned `<stanPath>/**` selection + meta archive clean-slate
  - Implemented engine-owned STAN selection exceptions (`<stanPath>/system/**` excluding `.docs.meta.json`, and `<stanPath>/imports/**`) and ignored config includes/excludes under `<stanPath>/**`.
  - Reserved host-private `<stanPath>/context/dependency.map.json` so it is never selected/archived.
  - Updated `archive.meta.tar` behavior to omit dependency state always (clean slate) and added optional `<stanPath>/output/**` inclusion for combine mode (archive files still excluded by tar filter).
  - Added focused regression tests and aligned README docs.

- Fix: restore dependency archive-flow force-include and test imports
  - Allow `includes` to re-include gitignored `<stanPath>/context/**` in dependency archive-flow wrappers; fix test tmp helper import path.

- Breaking: adopt dependency context meta/state v2 (compact) end-to-end
  - Replaced V1 schemas with V2 (n/e/k/s/d for meta, i/x/mask for state) and introduced host-private `dependency.map.json` for validation.
  - Updated build/stage/validate logic to use Map-driven integrity checks and V2 closure traversal.
  - Updated all unit tests to match V2 data structures and flows.
  - Resolved all typecheck and lint errors.

- Docs: add TypeDoc comments for exported config symbols
  - Added explicit TSDoc blocks for exported Rollup/Vitest/ESLint config exports (repo-root files present in the meta archive).
  - Next: ingest `src/**` (via context expansion) and add TypeDoc comments for exported library API symbols.

- Interop cleanup: prune stale messages
  - Removed `selection-report-wiring.md` (CLI has ingested the API).

- Docs: enforce File Ops fencing and discussion protocol
  - Updated system prompt parts to mandate tilde fences for File Ops.
  - Added "Discussion Protocol" for "discuss before implementing" triggers.

- Breaking: remove response-format reply validator
  - Removed `validateResponseMessage`/`validateOrThrow` and all related code/tests/docs.
  - Rationale: stan-cli patch application only sees user-copied patch payloads (not the full assistant reply), so reply-level validation is not enforceable in tooling.
  - Enforce dependency selection rationale via required `.stan/system/stan.scratch.md` updates and system-prompt/human gating instead.