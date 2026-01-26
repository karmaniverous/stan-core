# STAN — Requirements (stan-core engine)

This document lists durable requirements for the STAN engine (“stan-core”), which provides programmatic services for configuration, file selection, archiving/diffing/snapshotting, patch application, imports staging, response validation, and prompt assembly. It is intentionally free of CLI/TTY concerns, which are owned by stan-cli.

---

## Short-term memory device (stan.scratch.md)

STAN MUST support a short-term memory device that persists across turns and threads and is always included in the Base set of archives.

- Canonical path: `<stanPath>/system/stan.scratch.md` (repo default: `.stan/system/stan.scratch.md`).
- Purpose: “What I would want to know if I were at the top of a thread right now.”
- Behavior:
  - The assistant MUST actively rewrite scratch to stay current (not append-only).
  - The assistant MUST update scratch on every patch-carrying turn (code or docs), including turns that only update dependency state in `--context`.
  - Missing scratch is valid (it may have been deleted); the assistant should recreate it on the next patch-carrying turn.
  - If scratch is irrelevant to the current thread objective, the assistant should overwrite it (entirely) to match the new objective.
- Holistic work under context limits:
  - When a holistic view of a large code base cannot fit in a single thread, the assistant SHOULD perform breadth-first cohort selection across multiple turns/threads and persist a running model and findings in scratch.

## SSR-friendly dynamic import pattern (test stability)

- Motivation
  - Under Vitest 4 SSR, named-export bindings can be transiently unavailable during module evaluation. To keep tests stable without changing runtime behavior, modules that must resolve peer exports dynamically SHOULD use a named-or-default dynamic import pattern.
- Requirement
  - When a module must resolve a peer export at runtime in an SSR/testing context, prefer the named export and fall back to the default export’s property of the same name. Throw a clear error only if neither is present.
- Example (pattern)
  ```ts
  // Resolve "foo" from ./peer using a robust SSR-safe pattern.
  const getFoo = async (): Promise<(typeof import('./peer'))['foo']> => {
    const mod = await import('./peer');
    const named = (mod as { foo?: unknown }).foo;
    const viaDefault = (mod as { default?: { foo?: unknown } }).default?.foo;
    const fn = (typeof named === 'function' ? named : viaDefault) as
      | (typeof import('./peer'))['foo']
      | undefined;
    if (typeof fn === 'function') return fn;
    throw new Error('foo export not found in ./peer');
  };
  ```
- Guidance
  - Use this pattern only where dynamic resolution is required for test/SSR robustness; prefer normal static imports for production code paths whenever possible.
  - Do not introduce side effects or console I/O in the resolver; keep it pure and presentation-free.

## 1) stan-core — Requirements (engine)

### Context mode (`--context`) — archive composition (v2)

When context mode is enabled, the archive payload MUST be allowlist-only so STAN can operate in repositories where a full project archive would exceed model context limits.

Definitions

- Effective repo root: the directory STAN operates in for a run (after `--workspace` is applied). All “repo root” references in this section use this effective root.
- Dependency graph universe: the set of files scanned to produce `dependency.meta.json` (see below).
- Base: the minimal set of files that are always included in context-mode archives.

Hard requirements

- A context-mode thread MUST start from either a FULL archive or a META archive (never a DIFF-only archive).
- Archive selection in context mode MUST be allowlist-only and MUST be driven by:
  - the repo-root Base selection,
  - engine-owned STAN workspace inclusions,
  - dependency meta and (when applicable) dependency state,
  - and the dependency-state-selected file set (closure), with hard-denial `excludes`.
- Config `includes` and `excludes` MUST be ignored for any paths under `<stanPath>/**`. `<stanPath>/**` selection is engine-owned.

Base definition (fixed, config-driven)

- Base MUST be derived from the existing STAN selection configuration as currently read (gitignore + includes/excludes + reserved rules), not from special-case rules:
  - Base includes:
    - The “meta archive contents” (system docs + dependency meta; see below),
    - `<stanPath>/system/stan.scratch.md` (short-term memory; treated as top-of-thread context),
    - Plus the repo-root files selected by the current selection config, restricted to the repo root (top-level files only).
- Base MUST honor explicit `excludes` as hard denials (see “Excludes precedence”).
- Base MUST NOT be expanded by dependency traversal. Dependency traversal adds only to the allowlist beyond base.

Dependency graph universe vs archive selection

- The dependency graph universe is the seed for the dependency map. It MUST be sufficiently broad to support later selection via state without requiring full-archive ingestion by the assistant.
- For v2, the dependency graph universe SHOULD be the same selection used by the non-context archiving flow (the existing selection model driven by config includes/excludes and `.gitignore` semantics), even though the context-mode archive payload is allowlist-only.
- Archive selection begins from Base only; it does not implicitly include the full graph universe.

Excludes precedence (hard denials)

- In context mode, explicit `excludes` are hard denials and MUST be applied to:
  - Base construction (repo-root base files),
  - Repo-local node IDs selected by dependency closure,
  - Staged external node IDs selected by dependency closure.
- `.gitignore` semantics are applied by the existing selection model when building Base and when constructing the dependency graph universe.
- Explicit selection via dependency state MAY override `.gitignore` (i.e., gitignored files may be included if explicitly selected), but MUST NOT override explicit `excludes` or reserved denials.
- Config `includes`/`excludes` are ignored for `<stanPath>/**`, but `excludes` still apply to repo paths outside `<stanPath>/**`.

Meta archive alignment

- The META archive produced for context mode MUST include Base inputs sufficient for the assistant to author a correct dependency state file:
  - System prompt docs (per existing meta archive behavior),
  - `<stanPath>/context/dependency.meta.json`,
  - Repo-root base files (top-level files) selected by the current selection config.
- The META archive MUST omit `<stanPath>/context/dependency.state.json` even when it exists on disk so the assistant starts from a clean slate for selection directives.

Budgeting and selection heuristics (assistant contract)

- Token estimation is approximate and deterministic:
  - Treat file size in bytes as a proxy for characters.
  - Estimate tokens as `bytes / 4`.
- Context-mode archive size target (Dynamic "Half Remaining"):
  - Estimate the remaining context space ($R$) at the end of the current turn.
  - Target a dependency state update such that the **resulting diff archive** (patches + newly selected nodes) consumes no more than **50% of $R$**.
  - _Formula:_ $\text{Diff} \approx \text{Size}(\text{Patches}) + \text{Size}(\text{New Nodes})$.
  - Use `dependency.meta.json` sizes. If the plan exceeds this budget, prune the lowest-value nodes (e.g., dynamic imports, tests) from `dependency.state.json` before finalizing.
- “Need” MUST be defined by the next planned step, not by indefinite future exploration (avoid runaway expansion).
- Pruning MUST follow a deterministic ladder (highest-level intent; exact ordering may be refined but must remain stable):
  - Remove `dynamic` traversal first unless the task explicitly requires it.
  - Reduce depth before removing direct edit-target seeds.
  - Remove broad barrel/entrypoint seeds before removing narrow, directly relevant seeds.
  - Drop low-signal subtrees (tests/fixtures/generated/docs) before core source, when they are not needed.
- All policy-bearing thresholds and strings (including these budgeting constants) MUST be hoisted into named constants in feature-scoped constants modules.

Dependency state update enforcement (assistant + tooling contract)

- When dependency graph mode is active for a run (dependency meta is present), assistant replies that include any code patches MUST satisfy exactly one of:
  - Patch `<stanPath>/context/dependency.state.json` to request next-turn context changes, or
  - Explicitly indicate that no dependency state change is needed for the next turn and omit any dependency state patch.
- No-op state patches are forbidden:
  - The assistant MUST NOT emit a Patch block for `dependency.state.json` unless it changes the file contents.
- “No change” signal (stable, machine-checkable):
  - The assistant MUST include a bullet line exactly `dependency.state.json: no change` under `## Input Data Changes` when no state update is needed.
- Tooling MUST enforce this rule when dependency graph mode is active:
  - Validation MUST fail when dependency meta is present and neither:
    - a Patch for `dependency.state.json`, nor
    - the “no change” signal, is present.
  - Validation MUST fail when both a state Patch and the “no change” signal are present.

### Purpose

Provide a cohesive, dependency-light engine that implements the durable capabilities of STAN as pure TypeScript services. The engine is transport-agnostic.

### Scope

- Dependency graph mode (context expansion; new)
  - Purpose
    - Expand the archived context beyond baseline selection using a dependency graph (“meta”) and a selection state file (“state”).
    - This supersedes facet/anchor-based archive shaping as the primary mechanism for selecting context.
  - TypeScript provisioning (graph generation)
    - TypeScript is required by the context compiler (`@karmaniverous/stan-context`) and MUST be provided explicitly by the host (e.g., stan-cli) via injection (module or `typescriptPath`).
    - stan-core MUST NOT attempt to import or resolve TypeScript itself; it MUST pass through host-provided TypeScript inputs to stan-context and surface stan-context’s errors.
  - Canonical files and locations
    - Dependency artifacts live under `<stanPath>/context/` (repo default: `.stan/context/`) and SHOULD be gitignored:
      - `<stanPath>/context/dependency.meta.json` (assistant-facing meta; v2 compact)
      - `<stanPath>/context/dependency.state.json` (assistant-authored state; v2 compact)
      - `<stanPath>/context/dependency.map.json` (host-private map; regenerated each `run -c`; MUST NOT be archived)
      - staged external files:
        - `<stanPath>/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
        - `<stanPath>/context/abs/<sha256(sourceAbs)>/<basename>`
    - Archive outputs live under `<stanPath>/output/`:
      - `archive.tar` (full)
      - `archive.diff.tar` (diff)
      - `archive.meta.tar` (meta; only when context mode is enabled)
        - The meta archive MUST include system files and dependency meta.
        - The meta archive MUST omit dependency state even when it exists so the assistant starts from a clean slate for selections.
        - The meta archive MUST exclude staged payloads under `<stanPath>/context/{npm,abs}/**`.
        - The meta archive MUST exclude `<stanPath>/system/.docs.meta.json`.
  - Node IDs (graph + state; v2 invariant)
    - Node IDs MUST be repo-relative POSIX paths.
    - Node IDs MUST be archive-addressable paths: the path where the file exists inside archives.
    - External node IDs MUST be normalized to staged `<stanPath>/context/**` paths so the assistant never sees `node_modules/**` paths or OS absolute paths in the graph.
    - OS-level source resolution (where bytes come from) is transient to `stan run -c` and MUST NOT be written into assistant-facing meta/state.
  - Meta requirements (assistant-facing; v2 compact)
    - The dependency meta file MUST be compact and deterministic and MUST support stable decoding by assistants.
    - The meta file MUST NOT contain content hashes (to preserve assistant context budget). Integrity verification material lives in the host-private `dependency.map.json` file.
    - Stable decode tables and compact shapes are engine-owned and must be documented to assistants by the host.
    - The meta file MUST NOT include OS absolute-path locators for external nodes.
  - State file schema (v2; durable contract)
    - `DependencyStateEntryV2 = string | [string, number] | [string, number, number]`
      - string is `nodeId`
      - number is recursion depth (defaults to `0` when omitted; `0` means include only that nodeId)
      - number (third element) is `kindMask` bitmask (defaults to `7` when omitted)
    - `DependencyStateFileV2 = { v: 2; i: DependencyStateEntryV2[]; x?: DependencyStateEntryV2[] }`
      - Excludes win over includes.
      - Expansion traverses outgoing edges up to depth, restricted to `kindMask`.
  - Expansion precedence (dependency mode)
    - In `--context`, archive selection is allowlist-only (Base + selected closure) and explicit `excludes` are hard denials.
    - Reserved denials and binary exclusion always win.
  - Imports (baseline safety)
    - `.stan/imports/**` is staged context and MUST be treated as read-only by the assistant and engine operations:
      - never create, patch, or delete files under `.stan/imports/**`.
    - Engine SHOULD NOT attempt to deduplicate between `.stan/imports/**` and `<stanPath>/context/**`; selection decisions are handled at the assistant state level.
  - Undo/redo (strict validation; CLI + engine seam)
    - Undo/redo MUST fail immediately when the restored dependency selection cannot be satisfied by the current host run.
    - Validation/integrity enforcement MUST be map-driven using host-private `dependency.map.json` (locatorAbs + full sha256 + size).
    - The host (typically stan-cli) MUST rebuild dependency meta at `stan run -c` and use compiler-resolved source locations transiently to stage external bytes into `.stan/context/**`.
    - The host MUST refuse to stage (and therefore refuse to archive) when any selected external node cannot be resolved or fails map-driven verification.
    - The engine MUST NOT persist OS absolute locators in assistant-facing meta/state.
    - Note: this seam intentionally keeps meta thin and archive-addressable; it is acceptable that OS locators are runtime-only.
    - The host-private `dependency.map.json` MUST NOT be archived.

- Configuration (namespaced; canonical)
  - Config files are namespaced by consumer at the top level. Canonical keys:
    - `stan-core`: engine-owned object; REQUIRED by the engine.
    - `stan-cli`: CLI-owned object; out of scope for the engine.
  - The engine MUST read and strictly validate only the `stan-core` block with the minimal schema:
    - `stanPath: string (non-empty)`,
    - `includes?: string[]` (default `[]`),
    - `excludes?: string[]` (default `[]`),
    - `imports?: Record<string, string|string[]>` (normalized to arrays).
  - Unknown keys inside `stan-core` MAY be rejected (strict schema). Unknown keys outside `stan-core` are ignored by the engine.
  - Root-level legacy shapes and vendor extensions (e.g., `x-stan-cli`) are not part of the canonical model. Transitional acceptance is permitted only insofar as needed to keep STAN functional while both packages release the namespaced change.
  - Expose typed loaders (sync/async) that:
    - resolve config path,
    - select the `stan-core` object (error when missing),
    - return the minimal `ContextConfig` shape.

- Filesystem selection
  - Enumerate repository files (POSIX-normalized paths).
  - Apply selection rules:
    - default denials (`node_modules`, `.git`),
    - `.gitignore` semantics,
    - `includes` (additive, override `.gitignore`),
    - `excludes` (take precedence over `includes`),
    - reserved workspace rules (exclude `<stanPath>/diff` and `<stanPath>/patch`, conditionally exclude `<stanPath>/output`).
  - Config `includes` and `excludes` MUST be ignored for any files under `<stanPath>/**`. Selection under `<stanPath>/**` is engine-owned.
  - Context mode selection (authoritative):
    - In `--context`, archive selection is allowlist-only: Base + selected dependency closure (repo-local node IDs + staged externals), subject to reserved denials and binary exclusion.
    - Explicit `excludes` are hard denials and MUST apply to Base and closure.
    - Explicit dependency selection MAY override `.gitignore`, but MUST NOT override explicit excludes or reserved denials.
  - Precedence (documented behavior):
    - `includes` override `.gitignore` (not `excludes`).
    - `excludes` override `includes`.

- Archiving and diffs
  - Create full and diff archives:
    - `archive.tar` (full selection),
    - `archive.diff.tar` (changed since snapshot with snapshot management).
  - Dependency graph mode MAY also produce:
    - `archive.meta.tar` (system + dependency meta; omits dependency state always; excludes staged payloads by omission).
  - Classification at archive time:
    - Exclude binaries,
    - Flag large text by size and/or LOC.
  - Warnings must be exposed via return values and/or optional callbacks (no console I/O).
  - Combine behavior (`--combine`, host-owned):
    - When the host requests output combination, the resulting archives MUST include `<stanPath>/output/**` (script outputs and other non-archive outputs) and MUST exclude the known STAN archive files under `<stanPath>/output/`.
    - This applies to context-mode meta archives as well as full and diff archives.

- Snapshotting
  - Compute per-file content hashes for the filtered selection.
  - Read/write the diff snapshot (`.archive.snapshot.json`) and manage the sentinel (`.stan_no_changes`) path when there are no changes.

- Patch engine
  - Accept patch input as a string.
  - Worktree-first apply pipeline:
    - `git apply` cascade (p1→p0 variants with tolerant flags),
    - jsdiff fallback (whitespace/EOL tolerance, preserves original EOLs for edits),
    - structured outcome (attempt captures, per-file failures).
  - File Ops pre-ops:
    - `mv`, `cp`, `rm`, `rmdir`, `mkdirp` with normalized, safe repo-relative paths and a dry-run mode.

- Imports staging
  - Stage external artifacts under `<stanPath>/imports/<label>/...`:
    - Resolve globs,
    - Preserve “tail” paths relative to glob-parent,
    - Summarize staged files per label.

- Validation utilities (optional)
  - Response-format validator for assistant replies:
    - One Patch per file,
    - Correct `diff --git` header count/order,
    - Commit Message last,
    - TODO cadence rule.

- Prompt helpers (engine-side utilities)
  - `getPackagedSystemPromptPath` (dist monolith lookup).
  - `assembleSystemMonolith` (assemble parts → monolith; quiet, no logs).

### Non-goals

- No CLI/TTY responsibilities (no Commander, no clipboard, no editor spawning).
- No console output; diagnostics/warnings must flow back as data or via optional callbacks to the caller (CLI).
- No long-running interactive state (transport-agnostic services only).

### Public API (representative; stable)

- Config
  - `loadConfig(cwd)`, `loadConfigSync(cwd)`
  - `resolveStanPath(cwd)`, `resolveStanPathSync(cwd)`
- Selection/FS
  - `listFiles(root)`, `filterFiles(files, opts)`
- Archive/diff/snapshot
  - `createArchive(cwd, stanPath, options): Promise<string>`
  - `createArchiveDiff(args): Promise<{ diffPath: string }>`
  - `writeArchiveSnapshot({ cwd, stanPath, includes, excludes }): Promise<string>`
  - Classification utility included as internal detail; warnings surfaced by archive APIs.
  - Optional callback: `onArchiveWarnings?: (text: string) => void` (where supported).
- Patch engine
  - `detectAndCleanPatch(raw: string): string`
  - `applyPatchPipeline({ cwd, patchAbs, cleaned, check, stripOrder? }) → { ok, result, js }`
  - `parseFileOpsBlock(body: string) → { ops, errors }`
  - `executeFileOps(cwd, ops, dryRun) → { ok, results }`
- Imports
  - `prepareImports({ cwd, stanPath, map }) → Promise<void>`
  - Optional callback: `onStage?: (label: string, files: string[]) => void` (where supported).
- Validation
  - `validateResponseMessage(text) → { ok, errors, warnings }`
- Prompt helpers
  - `getPackagedSystemPromptPath(): string | null`
  - `assembleSystemMonolith(cwd, stanPath) → Promise<{ target: string; action: 'written' | 'skipped-no-parts' | 'skipped-no-md' }> `
- Metadata
  - `CORE_VERSION: string`

Notes

- API must remain deterministic across runs for identical inputs.
- Paths are POSIX repo-relative on input and output.

### Operational constraints

- Determinism: selection/archiving/snapshotting are deterministic for identical inputs.
- Path hygiene: external inputs/outputs use POSIX repo-relative paths.
- Side-effect bounds: changes are limited to documented workspace paths (e.g., `<stanPath>/output`, `<stanPath>/diff`, `<stanPath>/patch`).

### Dependencies

- Allowed at runtime: `tar`, `fs-extra`.
- Not allowed: clipboard libraries, CLI frameworks, TTY/presentation utilities.

### Cross-repo configuration alignment (CLI perspective)

- CLI MUST read and validate only the `stan-cli` top-level object (strict schema).
- Legacy vendor extensions (e.g., `x-stan-cli`) and legacy root keys are not canonical; any temporary acceptance is for the shortest possible transition window to keep STAN functional.

### Patch ingestion — creation fallback (engine behavior)

Improve success on “new document” diffs commonly malformed in chat:

- Trigger
  - Only after the standard pipeline fails (git + jsdiff),
  - Only when confidently identified as a creation patch (`/dev/null → b/<path>` or equivalent “add only” hunks).
- Behavior
  1. Extract payload by stripping diff headers and removing leading “+” from payload lines.
  2. Normalize EOL to LF for the written file (no pre-existing EOL to preserve).
  3. Ensure parent directories exist and create the file atomically.
- Guardrails
  - Never applies to edits of existing files.
  - Runs silently with a structured outcome; no console I/O.

### Testing

- Coverage for:
  - Config loaders and schema error messages (namespaced `stan-core` block).
  - Selection semantics (includes vs excludes precedence; reserved workspace exclusions; includes re-inclusion).
  - Archive classification (binary exclusion, large-text flags) and warnings surfacing (returns/callback).
  - Diff archive + snapshot handling (changed/no-changes sentinel).
  - Patch pipeline:
    - git apply attempt captures are structured and summarized,
    - jsdiff fallback on CRLF/LF variations,
    - creation fallback (simple, nested paths, sandbox/check).
  - File Ops parsing/execution (safety checks, dry-run).
  - Prompt helpers (packaged path, assemble parts).
  - Response-format validator (ordering, duplicate patches, commit position, TODO cadence).

### Documentation & versioning

- Semantic versioning for the engine package.
- API docs reflect only engine surfaces (no CLI guidance).
- Release notes highlight any behavior changes in selection, archiving, patch application, or validation.

### Cross-repo coordination (engine perspective)

- Imports bridge (context only; read-only under `.stan/imports/**`)
  - Typical label in stan-core: `cli-docs` → stage peer docs or threads as needed (narrow patterns).
  - Never write to `.stan/imports/**`; treat as read-only context for archiving and dev-plan decisions.

- Interop threads (lightweight, deterministic)
  - Outgoing messages: `.stan/interop/stan-cli/<UTC>-<slug>.md` (atomic Markdown).
  - Incoming messages are staged via imports; scan first, and prune outgoing notes once resolved (via File Ops).

## System‑level lint policy

Formatting and linting are enforced by the repository configuration; this system prompt sets expectations:

- Prettier is the single source of truth for formatting (including prose policy: no manual wrapping outside commit messages or code blocks).
- ESLint defers to Prettier for formatting concerns and enforces TypeScript/ordering rules (see repo config).
- Prefer small, automated style fixes over manual formatting in patches.
- Keep imports sorted (per repo tooling) and avoid dead code.

Assistant guidance

- When emitting patches, respect house style; do not rewrap narrative Markdown outside the allowed contexts.
- Opportunistic repair is allowed for local sections you are already modifying (e.g., unwrap manually wrapped paragraphs), but avoid repo‑wide reflows as part of unrelated changes.

ESLint rule disablements (extraordinary)

- The assistant MUST NOT add `eslint-disable` comments without a prior design discussion and agreement.
- If a disablement is approved, scope it as narrowly as possible (prefer `eslint-disable-next-line <rule>`) and include an inline comment explaining the rationale and (when applicable) the removal plan.
- Do not disable lint rules as a workaround for missing types; prefer proper typing, `unknown` + narrowing, or refactoring to smaller units.

## Context window exhaustion (termination rule)

When context is tight or replies risk truncation:

1. Stop before partial output. Do not emit incomplete patches or listings.
2. Dependency Graph Mode trigger:
   - When the remaining context estimate has shrunk to the point where the assistant can no longer create a useful update to the dependency state file, the assistant should request the opening of a new thread.
3. Prefer scratch-based continuity:
   - If you can still safely emit patches, update `<stanPath>/system/stan.scratch.md` to reflect the current state and intended next step, then stop.
4. If you cannot safely emit patches (including scratch), stop cleanly:
   - Do not attempt to emit partial diffs or long listings.
   - Ask the user to start a new thread and paste the tail of the current discussion alongside the most recent archives.

This avoids half‑applied diffs and ensures integrity of the patch workflow.
