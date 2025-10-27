# STAN — Requirements (stan-cli)

This document defines the durable requirements for STAN’s command‑line interface and runner (“stan‑cli”). The engine (“stan‑core”) exposes deterministic, presentation‑free services; stan‑cli remains a thin adapter over those services.

The requirements below express the desired end‑state behavior of the CLI, including facet overlay semantics and test infrastructure choices.

---

## 1) Purpose and scope

Provide a stable CLI that:

- Runs configured scripts and produces deterministic text outputs.
- Creates full and diff archives that capture the exact context to read.
- Applies unified‑diff patches safely and emits concise diagnostics when needed.
- Presents a live TTY UI (or logger output in non‑TTY) and robust cancellation.
- Manages an optional facet overlay to reduce archive size without losing breadcrumbs.
- Resolves and materializes the system prompt deterministically.
- Stays transport‑agnostic by delegating selection/diff/patch to stan‑core.

Out of scope for the CLI:

- File selection algorithms, archiving/diffing, or patch application logic (owned by stan‑core).
- Persisting large or non‑deterministic artifacts outside the STAN workspace.

---

## 2) Architecture and boundaries (CLI ↔ Core)

- CLI (adapters/presentation)
  - Acquire inputs (flags, clipboard, files), map them to core service inputs.
  - Render live progress or concise logs; handle TTY controls and exit codes.
  - Compose overlay (facets → includes/excludes/anchors); do not re‑implement core selection.
  - Open editors best‑effort; copy diagnostics to clipboard best‑effort.

- Core (services/pure behavior)
  - Configuration, selection, archiving, snapshotting, patch pipeline, imports staging, and response validation.
  - Presentation‑free; no console I/O. All warnings/notes surface via return values or optional callbacks.
  - Public helpers for prompt packaging and monolith assembly.

The engine remains swappable; the CLI must not assume engine location or bundling flavor.

---

## 3) Run (build & snapshot)

- Execute scripts
  - Default: concurrent; `-q/--sequential` preserves provided order (or config order when not enumerated).
  - Capture combined stdout/stderr to `<stanPath>/output/<key>.txt`, ensuring the file exists even if cancelled early.

- PATH augmentation (child processes)
  - Prepend nearest‑first chain of `node_modules/.bin` directories from repo root up to the filesystem root.
  - Cross‑platform: build with `path.delimiter`, set key as `PATH` (Node normalizes case on Windows).
  - No command rewriting; do not inject `npx`/`npm exec`. Augmentation is a no‑op when `.bin` folders are absent (e.g., PnP).

- Archives
  - `archive.tar` (full), `archive.diff.tar` (changed files since snapshot).
  - Combine mode (`-c/--combine`): include `<stanPath>/output` entries in archives and remove them from disk afterward; archives remain on disk.
  - Exclusion/classification (surfaced by core via callbacks/returns): binaries excluded; large text call‑outs are logged by the CLI only if surfaced from core.

- Plan and live UI
  - Print a multi‑line plan unless `-P/--no-plan`.
  - Live TTY table with cancellation keys (‘q’ cancel, ‘r’ restart session); logger lines in non‑TTY.

- Cancellation
  - SIGINT parity for live/non‑live.
  - Sequential scheduler gate prevents new spawns after cancel.
  - Archives are skipped on a cancelled session; non‑zero exit (best‑effort).

---

## 4) System prompt resolution and materialization

- Flag: `-m, --prompt <value>` where `<value>` ∈ {'auto' | 'local' | 'core' | <path>}; default 'auto'.
- Resolution:
  - local: require `<stanPath>/system/stan.system.md`; error if missing.
  - core: require packaged baseline from stan‑core (`getPackagedSystemPromptPath()`); error if missing.
  - auto: prefer local, fall back to core; error if neither available.
  - <path>: absolute or repo‑relative path; must exist.
- Materialization & diff:
  - The resolved source is materialized at `<stanPath>/system/stan.system.md` for the archive phase, then restored if replaced (write‑only when bytes differ).
  - Full archive always includes the file; diff includes it only when changed vs snapshot.
- Plan header:
  - Plan includes `prompt: …` with effective resolution (e.g., `auto → local (.stan/system/stan.system.md)`).
- No drift/version printing in `run` (preflight belongs elsewhere).

---

## 5) Patch (discuss & apply)

- Source precedence: argument → `-f/--file [filename]` (or configured default unless `-F/--no-file`) → clipboard.
- Kind classification:
  - File Ops only: structural verbs (mv/cp/rm/rmdir/mkdirp). Many operations allowed; dry‑run under `--check`.
  - Unified‑diff only: exactly one file per patch block (hard rule).
  - Mixed (“File Ops + Diff” in one payload) is invalid → compose diagnostics.
- Persistence/audit:
  - Save raw patch to `<stanPath>/patch/.patch`. Store rejects in `<stanPath>/patch/rejects/<UTC>/` when applicable.
- Diagnostics envelope:
  - Concise target list, attempt summaries (git apply), jsdiff reasons (if any). Copy to clipboard best‑effort.
- Editor:
  - Open the modified file on success (non‑check) using configured command (default `code -g {file}`), best‑effort/detached.

---

## 6) Snap (share & baseline)

- Write/update `<stanPath>/diff/.archive.snapshot.json`.
- Maintain bounded undo/redo under `<stanPath>/diff` with retention `maxUndos` (default 10).
- Optional stash: `-s/--stash` (git stash -u then pop), `-S/--no-stash`. On failure to stash, abort without writing a snapshot.
- Snapshot selection equals the run‑time selection rules composed by the CLI (repo includes/excludes, overlay anchors/excludes).

---

## 7) Facet overlay (view reduction with safe breadcrumbs)

Overlay lives entirely in the CLI. Core remains facet‑agnostic and receives only includes/excludes/anchors.

- Files under `<stanPath>/system/` (included in archives):
  - `facet.meta.json` (durable): facet name → `{ exclude: string[]; include: string[] }`
    - exclude: subtree or leaf‑glob patterns to drop when inactive and overlay enabled.
    - include: “anchors” that must always be kept (e.g., READMEs, indices).
  - `facet.state.json` (ephemeral): name → boolean; `true` = active (no drop), `false` = inactive (drop its exclude patterns). Omitted facets default to active.

- Reserved denials and precedence (engine‑documented behavior, enforced by core):
  - Anchors may re‑include paths after `.gitignore` and excludes but never override reserved denials:
    - `.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`,
    - archive outputs (`<stanPath>/output/archive*.tar`).
  - Precedence: `excludes` override `includes`; `anchors` override both (subject to reserved denials and binary screening).

- Overlay composition (CLI algorithm):
  1. Determine effective facet activation from state overridden by flags:
     - `-f/--facets [names...]`: overlay ON; listed facets active for this run; naked `-f` = all active (no hiding).
     - `-F/--no-facets [names...]`: overlay ON; listed facets inactive for this run; naked `-F` = overlay OFF.
     - If a facet is listed in both, activation wins (`-f`).
  2. Ramp‑up safety:
     - If an inactive facet has no anchor present under any of its excluded subtree roots, auto‑suspend the drop for this run (treat it as active) and report it in the plan/metadata.
  3. Compose overlay inputs for core:
     - Start with repo `includes`/`excludes`.
     - Add excludesOverlay (inactive subtree roots only; see tie‑breaker below).
     - Compute anchorsOverlay (union of all anchors) and augment for leaf‑globs under active roots (see below).
  4. Subtree tie‑breaker (enabled facet wins):
     - Normalize exclude “roots” from `facet.meta.json` (strip `/**`/`/*`, drop trailing `/`).
     - If an inactive root equals, is an ancestor of, or a descendant of an active root, drop that inactive root from excludesOverlay (do not hide overlapped subtrees).
  5. Leaf‑glob re‑inclusion (scoped anchors):
     - Treat leaf‑glob excludes (e.g., `**/*.test.ts`) from inactive facets as re‑included within each active root by adding scoped anchors `<activeRoot>/**/<leafGlobTail>`. This brings back just the matching files inside active areas without exposing them repo‑wide.
  6. Pass to core:
     - `includes: repo.includes`
     - `excludes: repo.excludes ∪ excludesOverlay`
     - `anchors: anchorsOverlay` (base anchors plus scoped anchors from step 5)

- Plan and metadata:
  - Plan “Facet view” shows overlay on/off, inactive facets, auto‑suspended facets, and anchor counts.
  - CLI updates `<stanPath>/system/.docs.meta.json.overlay` with:
    - `enabled`, `activated`, `deactivated`, `effective`, `autosuspended`, and `anchorsKept` (counts). Optional `overlapKept` may be recorded for diagnostics.

---

## 8) Testing and tooling (Vitest Option 1)

To minimize SSR‑related friction while keeping fast ESM testing:

- Default environment: node
  - `test.environment = 'node'` in vitest.config.ts.
  - Use DOM/happy‑dom only in suites that truly need a browser‑like environment via per‑file overrides.

- ESM‑friendly mocks (consistent shape)
  - Create a tiny helper for vi.mock/vi.doMock factories that always returns:
    - `{ __esModule: true, default: impl, ...impl }`
  - Use it for Node built‑ins and third‑party partial mocks (e.g., node:child_process, node:module, clipboardy, tar). When partially mocking, spread the actual module for unmocked members.

- Dynamic SUT import when mocks affect module evaluation
  - For suites where the subject imports mocked dependencies at module‑eval time:
    - `vi.resetModules();` install mocks; then `await import(SUT)`.
  - Prefer `vi.doMock` for clarity and control of installation order.

- CI stability
  - Consider `test.pool = 'forks'` in CI to reduce hoist/order surprises.
  - Keep `server.deps.inline: ['@karmaniverous/stan-core', 'tar']` to ensure mocks apply inside core where needed.

- Coverage
  - Keep Vitest v8 coverage for source; avoid testing built artifacts unless an explicit pipeline target requires it.

---

## 9) Configuration and defaults

- `cliDefaults` precedence: flags > `cliDefaults` > built‑ins.
- Supported keys:
  - Root: `debug`, `boring`.
  - Run: `archive`, `combine`, `keep`, `sequential`, `plan`, `live`, `hangWarn`, `hangKill`, `hangKillGrace`, `scripts`, `prompt`, `facets`.
  - Patch: `patch.file` (default filename).
  - Snap: `snap.stash`.
- Baseline run defaults:
  - `archive=true`, `combine=false`, `keep=false`, `sequential=false`, `live=true`,
  - `hangWarn=120`, `hangKill=300`, `hangKillGrace=10`, `scripts=true`, `prompt='auto'`.

---

## 10) Error handling and guardrails

- Prompt resolution failure: early error; no scripts/archives; suggest an alternative source; non‑zero exit.
- Cancellation: archives skipped on cancel path; gate prevents post‑cancel spawns; non‑zero exit best‑effort.
- Avoid spurious prompt rewrites: compare bytes before materializing; restore original or remove when done.
- Reserved denials: anchors and overlay never re‑include reserved paths; binaries remain screened by core.

---

## 11) Engine interactions (explicit)

The CLI composes these core surfaces (representative, stable):

- Config:
  - `loadConfig(cwd)`, `loadConfigSync(cwd)`, `resolveStanPath*`.
  - `ensureOutputDir(cwd, stanPath, keep)`.

- Archive/snapshot:
  - `createArchive(cwd, stanPath, { includes?, excludes?, anchors?, includeOutputDir?, onArchiveWarnings? })`
  - `createArchiveDiff({ cwd, stanPath, baseName, includes?, excludes?, anchors?, updateSnapshot, includeOutputDirInDiff?, onArchiveWarnings? })`
  - `writeArchiveSnapshot({ cwd, stanPath, includes?, excludes?, anchors? })`
  - `prepareImports({ cwd, stanPath, map })` (stages `.stan/imports/<label>/...`)

- Prompt helpers:
  - `getPackagedSystemPromptPath()`
  - `assembleSystemMonolith(cwd, stanPath)` (dev workflows only; quiet).

- Patch:
  - `detectAndCleanPatch`, `applyPatchPipeline`, `parseFileOpsBlock`, `executeFileOps`.

- Validation:
  - `validateResponseMessage`, `validateOrThrow`.

All core APIs are deterministic and presentation‑free; the CLI owns UX.

---

## 12) Documentation and versioning

- CLI help and docs must reflect:
  - Prompt resolution and plan line.
  - PATH augmentation and child env semantics.
  - Facet overlay strategy (tie‑breaker and scoped re‑inclusion).
  - Vitest Option 1 testing model.
- Semantic versioning; changelog calls out meaningful functional changes.
