# STAN — Requirements (stan-core engine)

This document lists durable requirements for the STAN engine (“stan-core”), which provides programmatic services for configuration, file selection, archiving/diffing/snapshotting, patch application, imports staging, response validation, and prompt assembly. It is intentionally free of CLI/TTY concerns, which are owned by stan-cli.

---

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

## 0) Swappable Core (engine integration contract)

stan-cli MUST be able to run against any compatible stan-core at runtime.

- Loader expectations
  - stan-core exports a constant `CORE_VERSION: string`.
  - stan-core publishes a stable, documented API surface (see “Public API”).
  - stan-core provides prompt helpers required by the CLI:
    - `getPackagedSystemPromptPath(): string | null` resolves packaged `dist/stan.system.md`.
    - `assembleSystemMonolith(cwd, stanPath)` assembles `<stanPath>/system/parts/*.md` into `<stanPath>/system/stan.system.md` in dev workflows (quiet helper; no logs).

- Packaging
  - Dist: ESM output under `dist/mjs` with `.d.ts` types under `dist/types`.
  - The published package is ESM-only (no CommonJS `require()` entrypoint).
  - No CLI binaries or TTY dependencies in the engine package.

---

## 1) stan-core — Requirements (engine)

### Context mode (`--context`) — allowlist-only archiving (v1)

When context mode is enabled, the archive payload MUST be allowlist-only so STAN can operate in repositories where a full project archive would exceed model context limits.

Definitions

- Effective repo root: the directory STAN operates in for a run (after `--workspace` is applied). All “repo root” references in this section use this effective root.
- Dependency graph universe: the set of files scanned to produce `dependency.meta.json` (see below).
- Base: the minimal set of files that are always included in context-mode archives.

Hard requirements

- Archive selection in context mode MUST be allowlist-only:
  - Full and diff archives MUST include only:
    - Base (defined below),
    - Plus the repo-local node IDs selected by the dependency state closure,
    - Plus staged external node IDs required by that selection (under `<stanPath>/context/{npm,abs}/...`),
    - Minus reserved denials and binaries (reserved denials and binary exclusion always win).
- This explicitly replaces the pre-context “archive almost everything (denylist)” behavior for `--context` runs.

Base definition (fixed, config-driven)

- Base MUST be derived from the existing STAN selection configuration as currently read (gitignore + includes/excludes/anchors + reserved rules), not from special-case rules:
  - Base includes:
    - The “meta archive contents” (system docs + dependency meta; see below),
    - The dependency state file (`<stanPath>/context/dependency.state.json`) when it exists,
    - Plus repo-root files selected by the current selection config, restricted to the repo root (top-level files only).
- Base MUST honor explicit `excludes` as hard denials (see “Excludes precedence”).
- Base MUST NOT be expanded by dependency traversal. Dependency traversal adds only to the allowlist beyond base.

Dependency graph universe vs archive selection

- The dependency graph universe is the seed for the dependency map. It MUST be sufficiently broad to support later selection via state without requiring full-archive ingestion by the assistant.
- For v1, the dependency graph universe SHOULD be the same selection used by the pre-context archiving flow (the existing STAN selection model driven by config includes/excludes/anchors and `.gitignore` semantics), even though the context-mode archive payload is allowlist-only.
- Archive selection begins from Base only; it does not implicitly include the full graph universe.

Excludes precedence (hard denials)

- In context mode, explicit `excludes` are hard denials and MUST be applied to:
  - Base construction (repo-root base files),
  - Repo-local node IDs selected by dependency closure,
  - Staged external node IDs selected by dependency closure.
- `.gitignore` semantics are applied by the existing selection model when building Base and when constructing the dependency graph universe.
- Explicit selection via dependency state MAY override `.gitignore` (i.e., gitignored files may be included if explicitly selected), but MUST NOT override explicit `excludes` or reserved denials.

Meta archive alignment

- The meta archive produced for context mode MUST include Base inputs sufficient for the assistant to author a correct dependency state file:
  - System prompt docs (per existing meta archive behavior),
  - `<stanPath>/context/dependency.meta.json`,
  - Repo-root base files (top-level files) selected by the current selection config,
  - `<stanPath>/context/dependency.state.json` when it exists.
- When `dependency.state.json` does not exist (new thread / fresh context-mode run), the assistant MUST respond by creating it to request the next turn’s context.

Budgeting and selection heuristics (assistant contract)

- Token estimation is approximate and deterministic:
  - Treat `metadata.size` (bytes) as a proxy for characters.
  - Estimate tokens as `bytes / 4`.
- Context-mode archive size target:
  - The archive payload SHOULD occupy roughly half of the assistant’s usable context budget.
  - The assistant SHOULD expand dependency selection until it either:
    - has what it believes it needs for the next planned step, or
    - reaches the target budget,
    - whichever comes LAST.
  - The assistant MAY perform controlled extra expansion beyond the target when necessary to reach sufficiency, but MUST cap this extra expansion at 65% of the usable context budget.
  - If over the target, the assistant MUST prune lowest-value context first until back at the target.
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
    - the “no change” signal,
    is present.
  - Validation MUST fail when both a state Patch and the “no change” signal are present.

### Purpose

Provide a cohesive, dependency‑light engine that implements the durable capabilities of STAN as pure TypeScript services. The engine is transport‑agnostic and swappable at runtime.

### Scope

- Dependency graph mode (context expansion; new)
  - Purpose
    - Expand the archived context beyond baseline selection using a dependency graph (“meta”) and a selection state file (“state”).
    - This supersedes facet/anchor-based archive shaping as the primary mechanism for selecting context.
  - TypeScript strictness (graph generation)
    - When the caller (CLI) directs stan-core to generate a dependency graph, stan-core MUST require TypeScript to be available and MUST throw if it is not available.
  - Canonical files and locations
    - Dependency artifacts live under `<stanPath>/context/` (repo default: `.stan/context/`) and SHOULD be gitignored:
      - `<stanPath>/context/dependency.meta.json` (assistant-facing meta)
      - `<stanPath>/context/dependency.state.json` (assistant-authored state)
      - staged external files:
        - `<stanPath>/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
        - `<stanPath>/context/abs/<sha256(sourceAbs)>/<basename>`
    - Archive outputs live under `<stanPath>/output/`:
      - `archive.tar` (full)
      - `archive.diff.tar` (diff)
      - `archive.meta.tar` (meta; only when context mode is enabled)
        - The meta archive MUST include system files and dependency meta.
        - The meta archive MUST exclude dependency state and staged payloads.
        - The meta archive MUST exclude `<stanPath>/system/.docs.meta.json`.
  - Node IDs (graph + state)
    - Node IDs MUST be repo-relative POSIX paths.
    - External nodes MUST NOT use literal `node_modules/...` paths as node IDs; they MUST be normalized to the staged `<stanPath>/context/...` paths so the assistant can select files that exist within archives deterministically.
  - Meta requirements (assistant-facing)
    - The dependency meta file MUST include:
      - deterministic graph nodes and edges (JSON-serializable),
      - per-node `metadata.hash` (sha256) and `metadata.size` (bytes) when applicable,
      - per-node `description` (when available from the context compiler),
      - `locatorAbs` ONLY for abs/outside-root nodes (used for strict undo validation).
    - The meta file MUST NOT include absolute-path locators for npm nodes.
  - State file schema (v1; durable contract)
    - `DependencyEdgeType = 'runtime' | 'type' | 'dynamic'`
    - `DependencyStateEntry = string | [string, number] | [string, number, DependencyEdgeType[]]`
      - string is `nodeId`
      - number is recursion depth (defaults to `0` when omitted; `0` means include only that nodeId)
      - edgeKinds defaults to `['runtime', 'type', 'dynamic']` when omitted
    - `DependencyStateFile = { include: DependencyStateEntry[]; exclude?: DependencyStateEntry[] }`
      - Excludes win over includes.
      - Expansion traverses outgoing edges up to depth, restricted to edgeKinds.
  - Expansion precedence (dependency mode)
    - In `--context`, archive selection is allowlist-only (Base + selected closure) and explicit `excludes` are hard denials.
    - Reserved denials and binary exclusion always win.
  - Imports (baseline safety)
    - `.stan/imports/**` is staged context and MUST be treated as read-only by the assistant and engine operations:
      - never create, patch, or delete files under `.stan/imports/**`.
    - Engine SHOULD NOT attempt to deduplicate between `.stan/imports/**` and `<stanPath>/context/**`; selection decisions are handled at the assistant state level.
  - Undo/redo (strict validation; CLI + engine seam)
    - Undo/redo MUST fail immediately when the restored dependency selection cannot be satisfied by the current environment.
    - Validation MUST be per-file hash (sha256), derived from the restored meta:
      - For npm nodes: locate `<pkgName>@<pkgVersion>` in the current install and validate `<pathInPackage>` hashes match `metadata.hash`.
      - For abs nodes: validate the file at `locatorAbs` hashes to `metadata.hash`.
    - This strict mismatch detection MUST be performed even if cached archives contain older staged bytes; mismatch is defined as environment incompatibility.

- Configuration (namespaced; canonical)
  - Config files are namespaced by consumer at the top level. Canonical keys:
    - `stan-core`: engine‑owned object; REQUIRED by the engine.
    - `stan-cli`: CLI‑owned object; out of scope for the engine.
  - The engine MUST read and strictly validate only the `stan-core` block with the minimal schema:
    - `stanPath: string (non‑empty)`,
    - `includes?: string[]` (default `[]`),
    - `excludes?: string[]` (default `[]`),
    - `imports?: Record<string, string|string[]>` (normalized to arrays).
  - Unknown keys inside `stan-core` MAY be rejected (strict schema). Unknown keys outside `stan-core` are ignored by the engine.
  - Root‑level legacy shapes and vendor extensions (e.g., `x-stan-cli`) are not part of the canonical model. Transitional acceptance is permitted only insofar as needed to keep STAN functional while both packages release the namespaced change.
  - Expose typed loaders (sync/async) that:
    - resolve config path,
    - select the `stan-core` object (error when missing),
    - return the minimal `ContextConfig` shape.

- Filesystem selection
  - Enumerate repository files (POSIX‑normalized paths).
  - Apply selection rules:
    - default denials (`node_modules`, `.git`),
    - `.gitignore` semantics,
    - `includes` (additive, override `.gitignore`),
    - `excludes` (take precedence over `includes`),
    - `anchors` (high‑precedence re‑inclusion; see below; deprecated as the primary context-control mechanism when dependency graph mode is used),
    - reserved workspace rules (exclude `<stanPath>/diff` and `<stanPath>/patch`, conditionally exclude `<stanPath>/output`).
  - Context Mode selection (peer to standard selection):
    - When enabled, selection starts with a **Mandatory Base** (System files + Staged Imports + Dependency Graph).
    - It then applies the **Context Overlay** from `<stanPath>/system/context.meta.json` (explicit file list).
    - **Override Rule**: Explicit entries in the Context Overlay MUST override default denials (specifically `node_modules` and `.gitignore`) to allow the AI to select external type definitions.
    - Configured `excludes` and Reserved Workspace rules still take precedence over the Context Overlay for safety.
    - Deprecation note:
      - Facet/anchor-based overlays are deprecated as the primary solution for context control; prefer dependency graph mode for expansion/targeting.
  - Anchors channel (new):
    - Core selection surfaces MUST accept an optional `anchors?: string[]` and re‑include matched paths after applying excludes and `.gitignore`.
    - Anchors MUST NOT override reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`, and archive outputs) and MUST NOT bypass binary screening.
    - Surfaces:
      - `filterFiles(files, { …, includes?, excludes?, anchors? })`
      - `createArchive(cwd, stanPath, { …, includes?, excludes?, anchors? })`
      - `createArchiveDiff({ …, includes?, excludes?, anchors?, … })`
      - `writeArchiveSnapshot({ …, includes?, excludes?, anchors? })`
  - Precedence (documented behavior):
    - `includes` override `.gitignore` (not `excludes`);
    - `excludes` override `includes`;
    - `anchors` override both `excludes` and `.gitignore`, subject to reserved denials and binary screening.

- Archiving and diffs
  - Create full and diff archives:
    - `archive.tar` (full selection),
    - `archive.diff.tar` (changed since snapshot with snapshot management).
  - Dependency graph mode MAY also produce:
    - `archive.meta.tar` (system + dependency meta only; excludes dependency state and staged payloads).
  - Classification at archive time:
    - Exclude binaries,
    - Flag large text by size and/or LOC.
  - Warnings must be exposed via return values and/or optional callbacks (no console I/O).
  - Dependency Graph inclusion:
    - If `@karmaniverous/stan-context` is available and Context Mode is enabled, generate the dependency graph.
    - Embed the graph JSON in the archive as `<stanPath>/context/dependency.meta.json`.
    - External node IDs MUST be normalized to staged `<stanPath>/context/...` paths.
    - Include `description` in the embedded meta for assistant prioritization.
  - Overlay metadata (CLI):
    - The CLI MUST write a machine‑readable `overlay` block to `<stanPath>/system/.docs.meta.json` each run capturing: `enabled`, per‑run overrides (`activated`/`deactivated`), final `effective` facet map, any `autosuspended` facets (ramp‑up safety), and optional `anchorsKept`.
    - This metadata MUST be included in both full and diff archives so the assistant can distinguish selection/view changes from code churn across turns across turns.

- Snapshotting
  - Compute per‑file content hashes for the filtered selection.
  - Read/write the diff snapshot (`.archive.snapshot.json`) and manage the sentinel (`.stan_no_changes`) path when there are no changes.

- Patch engine
  - Accept patch input as a string.
  - Worktree‑first apply pipeline:
    - `git apply` cascade (p1→p0 variants with tolerant flags),
    - jsdiff fallback (whitespace/EOL tolerance, preserves original EOLs for edits),
    - structured outcome (attempt captures, per‑file failures).
  - File Ops pre‑ops:
    - `mv`, `rm`, `rmdir`, `mkdirp` with normalized, safe repo‑relative paths and a dry‑run mode.

- Imports staging
  - Stage external artifacts under `<stanPath>/imports/<label>/...`:
    - Resolve globs,
    - Preserve “tail” paths relative to glob‑parent,
    - Summarize staged files per label.

- Validation utilities (optional)
  - Response‑format validator for assistant replies:
    - One Patch per file,
    - Correct `diff --git` header count/order,
    - Commit Message last,
    - TODO cadence rule.

- Prompt helpers (engine‑side utilities)
  - `getPackagedSystemPromptPath` (dist monolith lookup).
  - `assembleSystemMonolith` (assemble parts → monolith; quiet, no logs).

### Non‑goals

- No CLI/TTY responsibilities (no Commander, no clipboard, no editor spawning).
- No console output; diagnostics/warnings must flow back as data or via optional callbacks to the caller (CLI).
- No long‑running interactive state (transport‑agnostic services only).

### Public API (representative; stable)

- Config
  - `loadConfig(cwd)`, `loadConfigSync(cwd)`
  - `resolveStanPath(cwd)`, `resolveStanPathSync(cwd)`
- Selection/FS
  - `listFiles(root)`, `filterFiles(files, opts)`
- Archive/diff/snapshot
  - `createArchive(cwd, stanPath, options): Promise<string>`
  - `createArchiveDiff(args): Promise<{ diffPath: string }>`
  - `writeArchiveSnapshot({ cwd, stanPath, includes, excludes, anchors? }): Promise<string>`
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
  - `assembleSystemMonolith(cwd, stanPath) → Promise<{ target: string; action: 'written' | 'skipped-no-parts' | 'skipped-no-md' }>`
- Metadata
  - `CORE_VERSION: string`

Notes

- API must remain deterministic across runs for identical inputs.
- Paths are POSIX repo‑relative on input and output.

### Operational constraints

- Determinism: selection/archiving/snapshotting are deterministic for identical inputs.
- Path hygiene: external inputs/outputs use POSIX repo‑relative paths.
- Side‑effect bounds: changes are limited to documented workspace paths (e.g., `<stanPath>/output`, `<stanPath>/diff`, `<stanPath>/patch`).

### Dependencies

- Allowed at runtime: `tar`, `fs-extra`.
- Not allowed: clipboard libraries, CLI frameworks, TTY/presentation utilities.

### Cross‑repo configuration alignment (CLI perspective)

- CLI MUST read and validate only the `stan-cli` top‑level object (strict schema).
- Legacy vendor extensions (e.g., `x-stan-cli`) and legacy root keys are not canonical; any temporary acceptance is for the shortest possible transition window to keep STAN functional.

### Patch ingestion — creation fallback (engine behavior)

Improve success on “new document” diffs commonly malformed in chat:

- Trigger
  - Only after the standard pipeline fails (git + jsdiff),
  - Only when confidently identified as a creation patch (`/dev/null → b/<path>` or equivalent “add only” hunks).
- Behavior
  1. Extract payload by stripping diff headers and removing leading “+” from payload lines.
  2. Normalize EOL to LF for the written file (no pre‑existing EOL to preserve).
  3. Ensure parent directories exist and create the file atomically.
- Guardrails
  - Never applies to edits of existing files.
  - Runs silently with a structured outcome; no console I/O.

### Testing

- Coverage for:
  - Config loaders and schema error messages (namespaced `stan-core` block).
  - Selection semantics (includes vs excludes precedence; reserved workspace exclusions; anchors re‑inclusion).
  - Archive classification (binary exclusion, large‑text flags) and warnings surfacing (returns/callback).
  - Diff archive + snapshot handling (changed/no‑changes sentinel).
  - Patch pipeline:
    - git apply attempt captures are structured and summarized,
    - jsdiff fallback on CRLF/LF variations,
    - creation fallback (simple, nested paths, sandbox/check).
  - File Ops parsing/execution (safety checks, dry‑run).
  - Prompt helpers (packaged path, assemble parts).
  - Response‑format validator (ordering, duplicate patches, commit position, TODO cadence).

### Documentation & versioning

- Semantic versioning for the engine package.
- API docs reflect only engine surfaces (no CLI guidance).
- Release notes highlight any behavior changes in selection, archiving, patch application, or validation.

### Cross‑repo coordination (engine perspective)

- Imports bridge (context only; read‑only under `.stan/imports/**`)
  - Typical label in stan-core: `cli-docs` → stage peer docs or threads as needed (narrow patterns).
  - Never write to `.stan/imports/**`; treat as read‑only context for archiving and dev‑plan decisions.

- Interop threads (lightweight, deterministic)
  - Outgoing messages: `.stan/interop/stan-cli/<UTC>-<slug>.md` (atomic Markdown).
  - Incoming messages are staged via imports; scan first, and prune outgoing notes once resolved (via File Ops).
