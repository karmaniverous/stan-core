# STAN — Requirements (stan‑cli)

This document defines the durable, CLI‑focused requirements for STAN’s command‑line interface and runner (“stan‑cli”). It assumes the engine (“stan‑core”) is a separate package that exposes deterministic, presentation‑free services. Where appropriate, stan‑core surfaces are referenced explicitly; stan‑cli must remain a thin adapter over those services.

---

## 1) Purpose

Provide the user‑facing CLI (Commander‑based) and runner/TTY experience (live progress table, cancellation keys, concise logs) while delegating selection, archiving/diff/snapshot, patch application, and prompt utilities to stan‑core.

stan‑cli is the only place where process/TTY/clipboard/editor concerns are handled. It owns UX, composition, and orchestration; stan‑core owns data‑level decisions.

---

## 2) Scope (CLI subcommands and behaviors)

### 2.1 Run (build & snapshot)

- Invoke configured scripts (concurrent by default; sequential optionally).
- Produce deterministic outputs under `<stanPath>/output/*.txt`.
- Create both:
  - `<stanPath>/output/archive.tar` — full snapshot (text files per selection rules),
  - `<stanPath>/output/archive.diff.tar` — changed files vs snapshot (always when archiving).
- Render a live TTY progress table or concise logger lines in non‑TTY.
- Handle cancellation:
  - ‘q’ (TTY) or SIGINT cancels; archives are skipped; non‑zero exit (best‑effort).
  - Sequential scheduling gate prevents spawning further scripts after cancel.
- Combine mode (`-c/--combine`): include `<stanPath>/output` inside archives and remove on‑disk outputs after archiving (archives remain).
- Always restore workspace invariants on exit (TTY handlers, raw mode, cursor).

Script execution environment (required):

- CWD: Spawn scripts with `cwd` set to the repo root containing the resolved `stan.config.*`.
- Shell: Spawn with `shell: true` (platform default shell).
- PATH augmentation (hard requirement):
  - Before each script spawn, stan‑cli MUST prepend the following to the child’s PATH so repo dependencies are preferred and available without global installs:
    - `<repoRoot>/node_modules/.bin`
    - Each ancestor `<dir>/node_modules/.bin` walking upward to the filesystem root (nearest first, then parents) — this mimics npm’s script resolution in monorepos/workspaces.
  - Cross‑platform:
    - Use `path.delimiter` for concatenation (`:` on POSIX, `;` on Windows).
    - Set the environment variable key as `PATH` (Node normalizes case‑insensitively on Windows).
  - Stability:
    - Do not rewrite or wrap user commands (no implicit `npm exec`/`npx`); simply provide PATH so binaries like `cross-env` resolve locally.
    - If no `node_modules/.bin` directories exist (e.g., Yarn PnP), augmentation is a no‑op; scripts may still invoke via the package manager or nested npm scripts.
  - Non‑goals:
    - stan‑cli MUST NOT add user toolchains (e.g., `cross-env`) as runtime dependencies; resolution must rely on the target repo’s installation.
  - Precedence:
    - The augmented PATH MUST ensure local `.bin` entries take precedence over global binaries.

NEW — System prompt source (required; hard‑guarded):

- Flags: `-m, --prompt <value>` where `<value>` ∈ {'auto' | 'local' | 'core' | <path>}, default 'auto'.
- Resolution:
  - ‘local’: require `<stanPath>/system/stan.system.md` to exist; error if missing.
  - ‘core’: require packaged baseline from stan‑core (`getPackagedSystemPromptPath()`); error if missing.
  - ‘auto’ (default): prefer ‘local’; fall back to ‘core’; error if neither is available.
  - `<path>`: use the specified file (absolute or repo‑relative). Require readability; error if missing.
- Materialization & diff:
  - The resolved prompt is materialized at `<stanPath>/system/stan.system.md` for the entire archive phase (both full and diff).
  - It is always present in the full archive, and participates in the diff like any other file (appears in `archive.diff.tar` if it changed vs snapshot).
  - If stan‑cli writes or overwrites the file to present the chosen source, stan‑cli MUST restore prior state afterward (put original bytes back, or remove the file if it did not exist).
- No drift/version nudges:
  - stan‑cli MUST NOT print “drift” or “docs changed” preflight hints in `stan run`. (Those nudges belong elsewhere; the run behavior is authoritative based on the `--prompt` source.)
- Plan header:
  - The run plan printed by stan‑cli MUST include a single line that reflects the resolved system prompt for the run:
    - Examples:
      - `prompt: local (.stan/system/stan.system.md)`
      - `prompt: core (@karmaniverous/stan-core@<version>)`
      - `prompt: auto → local (.stan/system/stan.system.md)`
      - `prompt: /abs/or/relative/path/to/custom.system.md`
  - When `-P/--no-plan` is used, no plan (and thus no prompt line) is printed.

Run flags (complete set; precedence = flags > cliDefaults > built‑ins):

- Selection:
  - `-s, --scripts [keys...]` (presence w/o keys => run all known scripts)
  - `-S, --no-scripts` (conflicts with `-s`/`-x`)
  - `-x, --except-scripts <keys...>`
- Mode:
  - `-q, --sequential` / `-Q, --no-sequential`
- Archives/outputs:
  - `-a, --archive` / `-A, --no-archive`
  - `-c, --combine` / `-C, --no-combine` (implies archive; conflicts with `-A`)
  - `-k, --keep` / `-K, --no-keep`
- Plan:
  - `-p, --plan` (plan only; exit)
  - `-P, --no-plan` (suppress plan header; execute directly)
- Live UI and thresholds:
  - `-l, --live` / `-L, --no-live`
  - `--hang-warn <seconds>` (positive int; default 120)
  - `--hang-kill <seconds>` (positive int; default 300)
  - `--hang-kill-grace <seconds>` (positive int; default 10)
- System prompt:
  - `-m, --prompt <value>` as defined above.
- Defaults (built‑ins unless overridden by `cliDefaults.run.*`):
  - `archive=true`, `combine=false`, `keep=false`,
  - `sequential=false`, `live=true`,
  - `hangWarn=120`, `hangKill=300`, `hangKillGrace=10`,
  - `scripts=true` (when `-s` is omitted),
  - `prompt='auto'` (new).

Plan rendering (TTY and non‑TTY):

- Multi‑line plan body includes:
  - `mode`, `output`, `prompt`, `scripts`, `archive`, `combine`, `keep output dir`, `live`, and hang thresholds.
- Plan only (`-p`): prints plan and exits with no side effects.

- Cancellation & restart rules (hard):
  - Cancel or restart MUST prevent scheduling any new scripts and MUST terminate active scripts immediately. The archive phase MUST be skipped when cancelled or restarting. No `archive.tar` or `archive.diff.tar` may be produced after cancellation. Sequential runs MUST NOT start “next” scripts after cancel; restarts MUST re‑queue a fresh session promptly.

### 2.2 Patch (discuss & apply)

- Source of patch data (precedence):
  1. [input] argument (patch text),
  2. `-f, --file [filename]` (path explicit or from `cliDefaults.patch.file` unless `-F/--no-file`),
  3. clipboard (default fallback).
- Kind classification (hard rules):
  - File Ops (“### File Ops”): structural changes only (mv/cp/rm/rmdir/mkdirp); may include many operations; dry‑run under `--check`.
  - Diff (plain unified): exactly one file per Patch block (single‑file rule); jsdiff fallback engaged only after git‑apply cascade fails; robust EOL/whitespace handling.
  - File Ops + Diff in the same payload: invalid (compose diagnostics envelope).
- Persistence/audit:
  - Save raw patch to `<stanPath>/patch/.patch`.
  - Place rejects under `<stanPath>/patch/rejects/<UTC>/` when applicable.
- Diagnostics:
  - Compose compact envelope(s) with declared target paths, attempt summaries, and jsdiff reasons (if any); copy to clipboard best‑effort.
  - On diagnostics replies from the user, the assistant must produce Full, post‑patch listings only for the affected files (no patches), no commit message (assistant‑side rule).
- Editor:
  - Open modified file on success (non‑check) using `patchOpenCommand` (default `code -g {file}`), best‑effort/detached.

### 2.3 Snap (share & baseline)

- Write/update `<stanPath>/diff/.archive.snapshot.json`.
- Maintain bounded undo/redo history under `<stanPath>/diff` with retention `maxUndos` (default 10).
- Optional stash:
  - `-s, --stash` (git stash -u then pop), `-S, --no-stash`.
  - Success/empty stash logged concisely; on failure, abort without writing a snapshot.
- Selection is derived from repo config (includes/excludes); snapshot fidelity matches run’s underlying selection logic.
- No drift/version nudges: stan‑cli MUST NOT print “drift”/“docs changed” hints in `stan snap`.

### 2.4 Init (project bootstrap)

- Scan `package.json` scripts; prompt user (interactive) or write defaults (`--force`) to create/update `stan.config.yml|yaml|json`.
- Preserve unknown keys and key order when rewriting existing config.
- Ensure `.gitignore` entries for `<stanPath>/{output,diff,dist,patch}/`.
- Write docs metadata `<stanPath>/system/.docs.meta.json` with the installed CLI version (best‑effort). Do not install a prompt monolith here.
- Seed diff snapshot when missing (best‑effort).
- New‑repo default layout:
  - When no `stan.config.*` exists, `stan init` MUST create a namespaced configuration by default:
    - `stan-core`: engine keys (stanPath/includes/excludes/imports).
    - `stan-cli`: CLI keys (scripts/cliDefaults/patchOpenCommand/maxUndos/devMode).
  - Migration behavior remains unchanged for existing legacy configs (writes `.bak`, preserves unknown root keys, idempotent).

### 2.5 Interactions with stan‑core (explicit dependencies)

stan‑cli composes the following stan‑core surfaces (representative):

- Config:
  - `loadConfig(cwd)` / `loadConfigSync(cwd)` for repo config (ContextConfig).
  - `ensureOutputDir(cwd, stanPath, keep)` to prepare workspace.

- Archive & snapshot:
  - `createArchive(cwd, stanPath, options)` → `archive.tar`
  - `createArchiveDiff({ cwd, stanPath, baseName, includes, excludes, updateSnapshot, includeOutputDirInDiff })` → `{ diffPath }`
  - `writeArchiveSnapshot({ cwd, stanPath, includes, excludes })`
  - `prepareImports({ cwd, stanPath, map: imports })` (stages imports under `<stanPath>/imports/<label>/...`)

- Prompt helpers:
  - `getPackagedSystemPromptPath()` to locate packaged baseline (`dist/stan.system.md`).

- Patch engine:
  - `detectAndCleanPatch(...)`, `parseFileOpsBlock(...)`, `executeFileOps(...)`, `applyPatchPipeline(...)` (adapter pattern only; CLI acquires sources and prints diagnostics).

- Metadata:
  - `CORE_VERSION` (for banners/compat checks in the CLI).

All core calls MUST be deterministic and presentation‑free; stan‑cli is responsible for user‑visible logs and UI.

---

## 3) Non‑goals (stan‑cli)

- Engine responsibilities:
  - No selection logic, classification, archive writing, diff/snapshot computation, or patch application logic beyond adapter mapping — stan‑core owns those.
- No console I/O from stan‑core:
  - Engine APIs are presentation‑free; stan‑cli MUST NOT depend on core sending logs.
- No drift/version nudges in `run` and `snap`:
  - Those were removed; run behavior is authoritative via `--prompt`.

---

## 4) Interactions with stan‑core (explicit dependencies)

stan‑cli composes the following stan‑core surfaces (representative):

- Config:
  - `loadConfig(cwd)` / `loadConfigSync(cwd)` for repo config (ContextConfig).
  - `ensureOutputDir(cwd, stanPath, keep)` to prepare workspace.
- Archive & snapshot:
  - `createArchive(cwd, stanPath, options)` → `archive.tar`
  - `createArchiveDiff({ cwd, stanPath, baseName, includes, excludes, updateSnapshot, includeOutputDirInDiff })` → `{ diffPath }`
  - `writeArchiveSnapshot({ cwd, stanPath, includes, excludes })`
  - `prepareImports({ cwd, stanPath, map: imports })` (stages imports under `<stanPath>/imports/<label>/...`)
- Prompt helpers:
  - `getPackagedSystemPromptPath()` to locate packaged baseline (`dist/stan.system.md`).
- Patch engine:
  - `detectAndCleanPatch(...)`, `parseFileOpsBlock(...)`, `executeFileOps(...)`, `applyPatchPipeline(...)` (adapter pattern only; CLI acquires sources and prints diagnostics).

All core calls MUST be deterministic and presentation‑free; stan‑cli is responsible for user‑visible logs and UI.

---

## 5) CLI composition & defaults

- Precedence: flags > `cliDefaults` > built‑ins.
- Supported defaults under `cliDefaults.run`:
  - `archive`, `combine`, `keep`, `sequential`, `plan`, `live`, `hangWarn`, `hangKill`, `hangKillGrace`, `scripts`, and `prompt` (new).
- Supported defaults under:
  - `cliDefaults.patch.file`, `cliDefaults.snap.stash`,
  - Root defaults: `cliDefaults.debug`, `cliDefaults.boring`.
- Plan header MUST reflect the effective values (including the resolved `prompt`).

- Advanced per‑script warnings (CLI):
  - Each script entry MAY include:
    - `warnPattern: string` — a single regex source used to flag `[WARN]` when matched across the combined stdout/stderr (and persisted output).
    - `warnPatternFlags: string` — optional JS regex flags to apply when compiling `warnPattern` (full JavaScript flag set is accepted; invalid or duplicate flags are rejected).
  - The CLI MUST NOT add implicit flags (e.g., MUST NOT force `/i`); flags are exactly as provided.
  - Build script default warnings policy:
    - Ignore `@rollup/plugin-typescript` informational line: “outputToFilesystem option is defaulting to true”.
    - Ignore zod circular dependency warnings that originate under `node_modules/zod/...`.
    - Other rollup warnings still flag `[WARN]`.

---

## 6) Presentation & logs

- Live UI (TTY):
  - Single table with flush‑left alignment; stable header, summary, and hint.
  - Keys: ‘q’ (cancel), ‘r’ (restart (when onRestart provided)).
  - Restart responsiveness:
    - Restart should restart as close to instantly as possible. The runner MUST cancel/kill all tracked child processes immediately (no grace), stop scheduling further work, and re‑queue the session without creating archives or allowing a “current step” to finish.
  - Archive late‑cancel guard:
    - The archive phase MUST check cancellation just before starting and MUST NOT create archives if cancellation/restart was requested.
  - No alt‑screen by default; cursor hidden during updates; restored on stop.
- Logger (non‑TTY):
  - Concise per‑event lines with BORING tokens (`[WAIT]`, `[RUN]`, `[OK]`, `[FAIL]`, …).
- BORING detection:
  - Honor `STAN_BORING=1` (and `NO_COLOR=1`, `FORCE_COLOR=0`); always print stable, unstyled tokens under BORING/non‑TTY.

Assistant guidance

- When emitting patches, respect house style; do not rewrap narrative Markdown outside the allowed contexts.
- Opportunistic repair is allowed for local sections you are already modifying (e.g., unwrap manually wrapped paragraphs), but avoid repo‑wide reflows as part of unrelated changes.

# CRITICAL: Layout

- stanPath (default: `.stan`) is the root for STAN operational assets:
  - `/<stanPath>/system`: prompts & docs
    - `stan.system.md` — repo‑agnostic monolith (read‑only; assembled from parts)
    - `stan.project.md` — project‑specific prompt/policies that augment the system prompt (not for requirements)
    - `stan.requirements.md` — project requirements (desired end‑state). Maintained by STAN; developers MAY edit directly, but shouldn’t have to. Created on demand when needed (not by `stan init`).
  - `/<stanPath>/output`: script outputs and `archive.tar`/`archive.diff.tar`
  - /<stanPath>/diff: diff snapshot state (`.archive.snapshot.json`, `archive.prev.tar`, `.stan_no_changes`)
  - `/<stanPath>/dist`: dev build (e.g., for npm script `stan:build`)
  - `/<stanPath>/patch`: canonical patch workspace (see Patch Policy)
- Config key is `stanPath`.
- Bootloader note: A minimal bootloader may be present at `/<stanPath>/system/stan.bootloader.md` to help assistants locate `stan.system.md` in attached artifacts; once `stan.system.md` is loaded, the bootloader has no further role.

# Facet overlay (selective views with anchors)

This repository supports “facets” — named, selective views over the codebase designed to keep archives small while preserving global context via small anchor documents.

Files (under `<stanPath>/system/`)

- `facet.meta.json` (durable): facet definitions — name → `{ exclude: string[]; include: string[] }`. The `include` list contains anchor files (e.g., README/index docs) that must always be included to preserve breadcrumbs.
- `facet.state.json` (ephemeral, should always exist): facet activation for the next run — name → `boolean` (`true` = active/no drop; `false` = inactive/apply excludes). Keys mirror `facet.meta.json`.

Overlay status for the last run

- The CLI writes a machine‑readable summary to `<stanPath>/system/.docs.meta.json` in a top‑level `overlay` block that records:
  - `enabled`: whether the overlay was applied this run,
  - per‑run overrides (`activated`/`deactivated`),
  - the final `effective` map used for selection,
  - optional `autosuspended` facets (requested inactive but kept due to missing anchors),
  - optional `anchorsKept` (paths force‑included as anchors).
- Always read this block when present; treat selection deltas that follow overlay updates as view changes (not code churn).

Assistant obligations (every turn)

1. Read facet files first:
   - Load `facet.meta.json`, `facet.state.json`, and (when present) `.docs.meta.json.overlay`.
   - Treat large selection changes after overlay edits as view expansion.
2. Design the view (facets & anchors):
   - Propose or refine facet definitions in `facet.meta.json` to carve large areas safely behind small anchors (READMEs, indices, curated summaries).
   - Keep anchor docs useful and current: when code changes public surfaces or invariants, update the relevant anchor docs in the same change set.
   - Do not deactivate a facet unless at least one suitable anchor exists under the area being hidden. If anchors are missing, add them (and record their paths under `include`) before deactivation.
3. Set the view (next run):
   - Toggle `facet.state.json` (`true`/`false`) to declare the intended default activation for the next run. This is the assistant’s declarative control of perspective across turns.
4. Response format:
   - Use plain unified diffs to update `facet.meta.json`, anchor docs, and `facet.state.json`. Summarize rationale in the commit message.

Selection precedence (toolchain‑wide; informational)

- Reserved denials always win; anchors cannot override:
  - `.git/**`
  - `<stanPath>/diff/**`
  - `<stanPath>/patch/**`
  - `<stanPath>/output/archive.tar`, `<stanPath>/output/archive.diff.tar` (and future archive outputs)
  - Binary screening (classifier) remains in effect.
- Precedence across includes/excludes/anchors:
  - `includes` override `.gitignore` (but not `excludes`).
  - `excludes` override `includes`.
  - `anchors` (from facet meta) override both `excludes` and `.gitignore` (subject to reserved denials and binary screening).

Precedence within overlay (facet overlap)

- Enabled facets MUST win over disabled facets when their scopes overlap.
  - Practical rule: the overlay’s drop list (derived from inactive facets) MUST NOT hide any path that belongs to an enabled facet’s scope. Enabling a facet MUST make its scope visible regardless of other facets being disabled.
  - Example: enabling the “tests” facet MUST expose all test files even when the “live‑ui” facet is disabled and would otherwise exclude subtrees that contain tests.
  - Reserved denials still win; anchors cannot re‑include reserved paths or binaries.

Notes

- Facet files and overlay metadata are included in archives so the assistant can reason about the current view and evolve it. These files do not change Response Format or patch cadence.
- Keep facets small and purposeful; prefer a few well‑placed anchors over broad patterns.

# Facet‑aware editing guard (think beyond the next turn)

Purpose

- Prevent proposing content patches for files that are absent from the attached archives because a facet is inactive this run (overlay enabled).
- Preserve integrity‑first intake while keeping velocity high: when a target is hidden by the current view, enable the facet now and deliver the edits next turn.

Inputs to read first (when present)

- `<stanPath>/system/.docs.meta.json` — overlay record for this run:
  - `overlay.enabled: boolean`
  - `overlay.effective: Record<facet, boolean>` (true = active)
- `<stanPath>/system/facet.meta.json` — durable facet definitions:
  - `name → { exclude: string[]; include: string[] }`
  - exclude lists define facetized subtrees; include lists are anchors (always kept)

Guardrail (hard rule)

- If `overlay.enabled === true` and a target path falls under any facet whose `overlay.effective[facet] === false` (inactive this run), do NOT emit a content Patch for that target in this turn.
- Instead:
  - Explain that the path is hidden by an inactive facet this run.
  - Enable the facet for the next run:
    - Prefer a patch to `<stanPath>/system/facet.state.json` setting that facet to `true` (next‑run default), and
    - Tell the user to re‑run with `stan run -f <facet>` (overlay ON; facet active) or `stan run -F` (overlay OFF) for a full baseline.
  - Log the intent in `<stanPath>/system/stan.todo.md` (“enable facet <name> to edit <path> next turn”).
  - Deliver the actual content edits in the next turn after a run with the facet active (or overlay disabled).

Allowed mixing (keep velocity without violating integrity)

- It is OK to:
  - Patch other files that are already visible in this run.
  - Update `facet.meta.json` (e.g., add anchors) together with `facet.state.json`.
  - Create or update anchor documents (breadcrumbs) even when the facet is currently inactive — anchors are always included in the next run once listed in `include`.
- It is NOT OK to:
  - Emit a content Patch for a file under a facet you are enabling in the same turn.
  - Attempt to override reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`, and archive outputs under `<stanPath>/output/…`); anchors never override these.

Resolution algorithm (assistant‑side; POSIX paths)

1. Load `.docs.meta.json`. If absent or `overlay.enabled !== true`, skip this guard.
2. Load `facet.meta.json` and derive subtree roots for each facet’s `exclude` patterns (strip common glob tails like `/**` or `/*`, trim trailing “/”; ignore leaf‑globs such as `**/*.test.ts` for subtree matching).
3. For each intended patch target:
   - If the target lies under any facet subtree and that facet is inactive per `overlay.effective`, block the edit this turn and propose facet activation instead (see Guardrail).
4. If overlay metadata is missing but the target file is simply absent from the archive set, treat this as a hidden target; ask to re‑run with `-f <facet>` or `-F` and resume next turn.

Optional metadata (CLI nicety; not required)

- When `overlay.facetRoots: Record<facet, string[]>` is present in `.docs.meta.json`, prefer those pre‑normalized subtree roots over local glob heuristics.

Notes

- Reserved denials and binary screening always win; anchors cannot re‑include them.
- The goal is two‑turn cadence for hidden targets:
  - Turn N: enable the facet + log intent.
  - Turn N+1: deliver the content edits once the target is present in archives.

# stanPath discipline (write‑time guardrails)

Purpose

- Ensure all assistant‑emitted patches and file operations target the correct STAN workspace directory for this repository (the configured `stanPath`).
- Prevent common errors where patches are written to `stan/…` when the repo uses `.stan/…` (or vice‑versa), or where the literal placeholder `<stanPath>` appears in patch paths.

Resolve stanPath first (required)

1. Read `stan.config.yml|yaml|json` and extract `stan-core.stanPath`:
   - The value MUST be a non‑empty string; when present, treat it as authoritative.
2. If the config is not present in the archive, derive from observed layout:
   - Prefer the workspace directory that actually exists in the attached artifacts (e.g., `.stan/system/…`).
   - If both `.stan/…` and `stan/…` appear (unusual), prefer the one that contains `system/stan.system.md` or `system/` docs.
3. Fallback default (last resort): `.stan`.

Write‑time rules (hard)

- Always use the resolved `stanPath` for all repo‑relative targets under the STAN workspace:
  - `/<stanPath>/system/**`
  - `/<stanPath>/diff/**`
  - `/<stanPath>/output/**`
  - `/<stanPath>/patch/**`
  - Any other STAN paths (imports, dist, etc.).
- Never write to `stan/…` unless `stanPath === "stan"`.
- Never write to `.stan/…` unless `stanPath === ".stan"`.
- Never leave the literal placeholder `<stanPath>` in any patch path or File Ops argument. Compute concrete POSIX repo‑relative paths before emitting.

Pre‑send validation (assistant‑side check)

- Fail composition if any Patch path contains the literal `<stanPath>`.
- Fail composition if any Patch path refers to `stan/…` when `stanPath === ".stan"`, or `.stan/…` when `stanPath === "stan"`.
- Paths MUST be POSIX (forward slashes) and repo‑relative.

Input clarity (optional)

- In “Input Data Changes” or the first relevant section of a reply, it is acceptable (not required) to echo the resolved `stanPath` for this run, e.g., “stanPath resolved: `.stan`”. This helps reviewers spot a mismatch early.

Notes

- These rules apply only to assistant‑emitted content (patches and file ops). The bootloader’s read‑side fallbacks (e.g., probing `.stan` then `stan`) exist for compatibility with older archives and do not affect write‑time discipline.
- The rules compose with other guards:
  - Reserved denials remain in effect (e.g., do not place content under `/<stanPath>/diff/**`, `/<stanPath>/patch/**`, or archive outputs in `/<stanPath>/output/**`).
  - The facet‑aware editing guard still applies: do not propose edits under an inactive facet this run; enable the facet first and emit patches next turn.

# Default Task (when files are provided with no extra prompt)

Primary objective — Plan-first

- Finish the swing on the development plan:
  - Ensure `<stanPath>/system/stan.todo.md` (“development plan” / “dev plan” / “implementation plan” / “todo list”) exists and reflects the current state (requirements + implementation).
  - If outdated: update it first (as a patch with Full Listing + Patch) using the newest archives and script outputs.
  - Only after the dev plan is current should you proceed to code or other tasks for this turn (unless the user directs otherwise).

MANDATORY Dev Plan update (system-level):

- In every iteration where you:
  - complete or change any plan item, or
  - modify code/tests/docs, or
  - materially advance the work, you MUST update `<stanPath>/system/stan.todo.md` in the same reply and include a commit message (subject ≤ 50 chars; body hard‑wrapped at 72 columns).

Step 0 — Long-file scan (no automatic refactors)

- Services‑first proposal required:
  - Before generating code, propose the service contracts (ports), orchestrations, and return types you will add/modify, and specify which ports cover side effects (fs/process/network/clipboard).
  - Propose adapter mappings for each consumer surface: • CLI (flags/options → service inputs), • and, if applicable, other adapters (HTTP, worker, CI, GUI).
  - Adapters must remain thin: no business logic; no hidden behavior; pure mapping + presentation.
  - Do not emit code until these contracts and mappings are agreed.
  - Apply SRP to modules AND services; if a single unit would exceed ~300 LOC, return to design and propose a split plan (modules, responsibilities, tests) before generating code.

- Test pairing check (new code):
  - For every new non‑trivial module you propose, include a paired `*.test.ts`. If you cannot, explain why in the module header comments and treat this as a design smell to resolve soon.
  - If multiple test files target a single artifact, consider that evidence the artifact should be decomposed into smaller services/modules with their own tests.

- Before proposing or making any code changes, enumerate all source files and flag any file whose length exceeds 300 lines.
- This rule applies equally to newly generated code:
  - Do not propose or emit a new module that exceeds ~300 lines. Instead, return to design and propose a split plan (modules, responsibilities, tests) before generating code.
- Present a list of long files (path and approximate LOC). For each file, do one of:
  - Propose how to break it into smaller, testable modules (short rationale and outline), or
  - Document a clear decision to leave it long (with justification tied to requirements).
- Do not refactor automatically. Wait for user confirmation on which files to split before emitting patches.

Dev plan logging rules (operational)

- “Completed” is the final major section of the dev plan.
- Append‑only: add new Completed items at the bottom so their order reflects implementation order. Do not modify existing Completed items.
- Corrections/clarifications are logged as new list entries (appended) — i.e., amendments to the list, not edits to prior items.
- Prune Completed entries that are not needed to understand the work in flight; keep only minimal context to avoid ambiguity.
- Do not number dev plan items. Use nested headings/bullets for structure, and express priority/sequence by order of appearance.
- Exception: a short, strictly ordered sub‑procedure may use a local numbered list where bullets would be ambiguous.

Assume the developer wants a refactor to, in order:

1. Elucidate requirements and eliminate test failures, lint errors, and TS errors.
2. Improve consistency and readability.
3. DRY the code and improve generic, modular architecture.

If info is insufficient to proceed without critical assumptions, abort and clarify before proceeding.

# Requirements Guidelines

- For each new/changed requirement:
  - Add a requirements comment block at the top of each touched file summarizing all requirements that file addresses.
  - Add inline comments at change sites linking code to specific requirements.
  - Write comments as current requirements, not as diffs from previous behavior.
  - STAN maintains durable, project‑level requirements in `/<stanPath>/system/stan.requirements.md`. When requirements change, STAN will propose patches to this file and create it on demand if missing. Developers MAY edit it directly, but shouldn’t have to.
  - Do NOT place requirements in `/<stanPath>/system/stan.project.md`. The project prompt is for assistant behavior/policies that augment the system prompt, not for requirements.
  - Clean up previous requirements comments that do not meet these guidelines.

## Commit message output

- MANDATORY: Commit message MUST be wrapped in a fenced code block.
  - Use a plain triple-backtick fence (or longer per the fence hygiene rule if needed).
  - Do not annotate with a language tag; the block must contain only the commit message text.
  - Emit the commit message once, at the end of the reply.
  - This rule applies to every change set, regardless of size.

- At the end of any change set, the assistant MUST output a commit message.
  - Subject line: max 50 characters (concise summary).
  - Body: hard-wrapped at 72 columns.
  - Recommended structure:
    - “When: <UTC timestamp>”
    - “Why: <short reason>”
    - “What changed:” bulleted file list with terse notes
- The fenced commit message MUST be placed in a code block fence that satisfies the +1 backtick rule (see Response Format).
- When patches are impractical, provide Full Listings for changed files, followed by the commit message. Do not emit unified diffs in that mode.

## Exception — patch failure diagnostics:

- When responding to a patch‑failure diagnostics envelope:
  - Do NOT emit a Commit Message.
  - Provide Full, post‑patch listings ONLY (no patches) for each affected file. If multiple envelopes are pasted, list the union of affected files.
  - Apply the 300‑LOC decomposition pivot: if any listed file would exceed 300 LOC, emit a decomposition plan (File Ops) and provide Full Listings for the decomposed files instead of the monolith. See “Patch failure prompts” for details.

# Fence Hygiene (Quick How‑To)

Goal: prevent hashed or broken templates/examples that contain nested code blocks.

Algorithm

1. Scan every block you will emit (patches, templates, examples). Compute the maximum contiguous run of backticks inside each block’s content.
2. Choose the outer fence length as N = (max inner backticks) + 1 (minimum 3).
3. Re‑scan after composing. If any block’s outer fence is ≤ the max inner run, bump N and re‑emit.

Hard rule (applies everywhere)

- Do not rely on a fixed backtick count. Always compute, then re‑scan.
- This applies to the Dependency Bug Report template, patch failure diagnostics envelopes, and any example that includes nested fenced blocks.

# Response Format (MANDATORY)

CRITICAL: Fence Hygiene (Nested Code Blocks) and Coverage

- You MUST compute fence lengths dynamically to ensure that each outer fence has one more backtick than any fence it contains.
- Algorithm:
  1. Collect all code blocks you will emit (every “Patch” per file; any optional “Full Listing” blocks, if requested).
  2. For each block, scan its content and compute the maximum run of consecutive backticks appearing anywhere inside (including literals in examples).
  3. Choose the fence length for that block as maxInnerBackticks + 1 (minimum 3).
  4. If a block contains other fenced blocks (e.g., an example that itself shows fences), treat those inner fences as part of the scan. If the inner block uses N backticks, the enclosing block must use at least N+1 backticks.
  5. If a file has both a “Patch” and an optional “Full Listing”, use the larger fence length for both blocks.
  6. Never emit a block whose outer fence length is less than or equal to the maximum backtick run inside it.
  7. After composing the message, rescan each block and verify the rule holds; if not, increase fence lengths and re‑emit.

General Markdown formatting

- Do not manually hard‑wrap narrative Markdown text. Use normal paragraphs and headings only.
- Allowed exceptions:
  - Commit Message block: hard‑wrap at 72 columns.
  - Code blocks: wrap lines as needed for code readability.
- Lists:
  - Use proper Markdown list markers (“-”, “\*”, or numbered “1.”) and indent for nested lists.
  - Do not use the Unicode bullet “•” for list items — it is plain text, not a list marker, and formatters (Prettier) may collapse intended line breaks.
  - When introducing a nested list after a sentence ending with a colon, insert a blank line if needed so the nested list is recognized as a list, not paragraph text.
  - Prefer nested lists over manual line breaks to represent sub‑items.
  - Requirements & TODO documents: do not number primary (top‑level) items. Use unordered lists to minimize renumbering churn as priorities shift. Numbering may be used in clearly stable, truly ordered procedures only.

- Opportunistic repair: when editing existing Markdown files or sections as part of another change, if you encounter manually wrapped paragraphs, unwrap and reflow them to natural paragraphs while preserving content. Do not perform a repository‑wide reflow as part of an unrelated change set.
- Coverage and mixing rules:
  - Normal replies (non‑diagnostics): provide Patches only (one Patch per file). Do not include Full Listings by default.
  - Diagnostics replies (after patch‑failure envelopes): provide Full Listings only for each affected file (no patches). Support multiple envelopes by listing the union of affected files. Do not emit a Commit Message.
  - Never deliver a Patch and a Full Listing for the same file in the same turn.
  - Tool preference & scope:
    - Use File Ops for structural changes (mv/cp/rm/rmdir/mkdirp), including bulk operations; File Ops are exempt from the one‑patch‑per‑file rule.
    - Use Diff Patches for creating new files or changing files in place.
    - Combine when needed: perform File Ops first, then emit the Diff Patch(es) for any content edits in their new locations.

Use these headings exactly; wrap each Patch (and optional Full Listing, when applicable) in a fence computed by the algorithm above.

---

## FILE OPERATION (optional)

<change summary>

```
### File Ops
<one operation per line>
```

## Input Data Changes

- Bullet points summarizing integrity, availability, and a short change list.

## CREATED: path/to/file/a.ts

<change summary>

### Patch: path/to/file/a.ts

```diff
diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,4 +1,4 @@
-export const x = 1;
+export const x = 2;
 export function y() {
   return x;
 }
```

## UPDATED: path/to/file/b.ts

<change summary>

### Patch: path/to/file/b.ts

```diff
diff --git a/src/newfile.ts b/src/newfile.ts
--- /dev/null
+++ b/src/newfile.ts
@@ -0,0 +1,4 @@
+/** src/newfile.ts */
+export const created = true;
+export function fn() { return created; }
+
```

## DELETED: path/to/file/c.ts

<change summary>

### Patch: path/to/file/c.ts

```diff
diff --git a/src/oldfile.ts b/src/oldfile.ts
--- a/src/oldfile.ts
+++ /dev/null
@@ -1,4 +0,0 @@
-export const old = true;
-export function gone() {
-  return old;
-}
```

## Commit Message

- Output the commit message at the end of the reply wrapped in a fenced code block. Do not annotate with a language tag. Apply the +1 backtick rule. The block contains only the commit message (subject + body), no surrounding prose.

## Validation

- Normal replies:
  - Confirm one Patch block per changed file (and zero Full Listings).
  - Confirm fence lengths obey the +1 backtick rule for every block.
  - Confirm that no Patch would cause any file to exceed 300 LOC; pivoted decomposition patches instead.
- Diagnostics replies (after patch‑failure envelopes):
  - Confirm that the reply contains Full Listings only (no patches), one per affected file (union across envelopes).
  - Confirm fence lengths obey the +1 backtick rule for every block.
  - Confirm that no listed file exceeds 300 LOC; if it would, pivoted decomposition + listings for the decomposed files instead.

---

## Post‑compose verification checklist (MUST PASS)

Before sending a reply, verify all of the following:

1. One‑patch‑per‑file (Diff Patches only)
   - There is exactly one Patch block per changed file.
   - Each Patch block MUST contain exactly one `diff --git a/<path> b/<path>` header.
   - No Patch block contains more than one `diff --git a/<path> b/<path>`.
   - Forbidden wrappers are not present: `*** Begin Patch`, `*** Add File:`, `Index:` (or similar non‑unified preludes).
   - For new files, headers MUST be `--- /dev/null` and `+++ b/<path>`.
   - For deleted files, headers MUST be `--- a/<path>` and `+++ /dev/null`.
   - Never mix a Patch and a Full Listing for the same file in the same turn.
   - Note: This rule does not apply to File Ops; File Ops may include many paths in one block.

2. Commit message isolation and position
   - Normal replies: The “Commit Message” is MANDATORY. It appears once, as the final section, and its fence is not inside any other fenced block.
   - Diagnostics replies (after patch‑failure envelopes): Do NOT emit a Commit Message.

3. Fence hygiene (+1 rule)
   - For every fenced block, the outer fence is strictly longer than any internal backtick run (minimum 3).
   - Patches, optional Full Listings, and commit message all satisfy the +1 rule.
4. Section headings
   - Headings match the template exactly (names and order).

5. Documentation cadence (gating)
   - Normal replies: If any Patch block is present, there MUST also be a Patch for <stanPath>/system/stan.todo.md that reflects the change set (unless the change set is deletions‑only or explicitly plan‑only). The “Commit Message” MUST be present and last.
   - Diagnostics replies: Skip Commit Message; listings‑only for the affected files.
6. Nested-code templates (hard gate)
   - Any template or example that contains nested fenced code blocks (e.g., the Dependency Bug Report or a patch failure diagnostics envelope) MUST pass the fence‑hygiene scan: compute N = maxInnerBackticks + 1 (min 3), apply that fence, then re‑scan before sending. If any collision remains, STOP and re‑emit. If any check fails, STOP and re‑emit after fixing. Do not send a reply that fails these checks.
7. Dev plan “Completed” (append‑only; last)
   - If `.stan/system/stan.todo.md` is patched:
     - “Completed” is still the final major section of the document.
     - Only new lines were appended at the end of “Completed”; no existing lines above the append point were modified or re‑ordered.
     - Corrections/clarifications, if any, are logged as a new one‑line “Amendment:” entry appended at the bottom instead of editing the original item.
     - Lists remain unnumbered.
     - Violations fail composition.

## Patch policy reference

Follow the canonical rules in “Patch Policy” (see earlier section). The Response Format adds presentation requirements only (fencing, section ordering, per‑file one‑patch rule). Do not duplicate prose inside patch fences; emit plain unified diff payloads.

Optional Full Listings — Normal replies only: when explicitly requested by the user in a non‑diagnostics turn, include Full Listings for the relevant files; otherwise omit listings by default. Diagnostics replies (after patch‑failure envelopes) MUST provide Full, post‑patch listings as described above (no patches, union across envelopes, no commit message). Skip listings for deletions.

Dev plan Completed enforcement (pre‑send)

- If `<stanPath>/system/stan.todo.md` is patched in this turn, enforce late‑append semantics for the “Completed” section:
  - “Completed” MUST remain the final major section of the document.
  - Only append new lines at the end of “Completed”. Do NOT modify existing lines above the final append point (no edits, no insertions, no re‑ordering).
  - If a correction/clarification is needed for a prior item, append a new one‑line “Amendment:” entry at the bottom instead of editing the original item.
  - Lists remain unnumbered.
  - Violations MUST fail composition; re‑emit with an end‑append only change.

## File Ops (optional pre‑ops; structural changes)

Use “### File Ops” to declare safe, repo‑relative file and directory operations that run before content patches. File Ops are for structure (moves/renames, creates, deletes), while unified‑diff Patches are for editing file contents.

- Verbs:
  - mv <src> <dest> # move/rename a file or directory (recursive), no overwrite
  - cp <src> <dest> # copy a file or directory (recursive), no overwrite; creates parents for <dest>
  - rm <path> # remove file or directory (recursive)
  - rmdir <path> # remove empty directory (explicit safety)
  - mkdirp <path> # create directory (parents included)
- Multiple targets:
  - Include as many operations (one per line) as needed to handle an entire related set of structural changes in a single patch turn.
- Paths:
  - POSIX separators, repo‑relative only.
  - Absolute paths are forbidden. Any “..” traversal is forbidden after normalization.
- Arity:
  - mv and cp require 2 paths; rm/rmdir/mkdirp require 1.
- Execution:
  - Pre‑ops run before applying unified diffs.
  - In --check (dry‑run), pre‑ops are validated and reported; no filesystem changes are made.

Examples

```
### File Ops
mkdirp src/new/dir
mv src/old.txt src/new/dir/new.txt
cp src/new/dir/new.txt src/new/dir/copy.txt
rm src/tmp.bin
rmdir src/legacy/empty
```

```
### File Ops
mv packages/app-a/src/util.ts packages/app-b/src/util.ts
mkdirp packages/app-b/src/internal
rm docs/drafts/obsolete.md
```
