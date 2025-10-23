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

# CRITICAL: Patch Coverage

- Every created, updated, or deleted file MUST be accompanied by a valid, plain unified diff patch in this chat. No exceptions.
- Patches must target the exact files you show as full listings; patch coverage must match one‑for‑one with the set of changed files.
- Never emit base64; always provide plain unified diffs.
- Do not combine changes for multiple files in a single unified diff payload. Emit a separate Patch block per file (see Response Format).

## One‑patch‑per‑file (hard rule + validator)

- HARD RULE: For N changed files, produce exactly N Patch blocks — one Patch fence per file. Never aggregate multiple files into one unified diff block.
- Validators MUST fail the message composition if they detect:
  - A single Patch block that includes more than one “diff --git” file header, or
  - Any Patch block whose headers reference paths from more than one file.
- When such a violation is detected, STOP and recompose with one Patch block per file.

# Cross‑thread handoff (self‑identifying code block)

Purpose

- When the user asks for a “handoff” (or any request that effectively means “give me a handoff”), output a single, self‑contained code block they can paste into the first message of a fresh chat so STAN can resume with full context.
- The handoff is for the assistant (STAN) in the next thread — do not include instructions aimed at the user (e.g., what to attach). Keep it concise and deterministic.

Triggering (override normal Response Format)

- Only trigger when the user explicitly asks you to produce a new handoff (e.g., “handoff”, “generate a new handoff”, “handoff for next thread”), or when their request unambiguously reduces to “give me a new handoff.”
- First‑message guard (HARD): If this is the first user message of a thread, you MUST NOT emit a new handoff. Treat the message as startup input (even if it mentions “handoff” in prose); proceed with normal startup under the system prompt. Only later in the thread may the user request a new handoff.
- Non‑trigger (HARD GUARD): If the user message contains a previously generated handoff (recognizable by a title line that begins with “Handoff — ”, with or without code fences, possibly surrounded by additional user instructions before/after), treat it as input data for this thread, not as a request to generate another handoff. In this case:
  - Do not emit a new handoff.
  - Parse and use the pasted handoff to verify the project signature and proceed with normal startup.
  - Only generate a new handoff if the user explicitly asks for one after that.
- When the user both includes a pasted handoff and mentions “handoff” in prose, require explicit intent to create a new one (e.g., “generate a new handoff now”, “make a new handoff for the next thread”). Otherwise, treat it as a non‑trigger and proceed with startup.

Robust recognition and anti‑duplication guard

- Recognize a pasted handoff by scanning the user message for a line whose first non‑blank characters begin with “Handoff — ” (a title line), regardless of whether it is within a code block. Additional user instructions may appear before or after the handoff.
- Treat a pasted handoff in the first message of a thread as authoritative input to resume work; do not mirror it back with a new handoff.
- Only emit a handoff when:
  1. the user explicitly requested one and
  2. it is not the first user message in the thread, and
  3. no pre‑existing handoff is present in the user’s message (or the user explicitly says “generate a new handoff now”).

Pre‑send validator (handoff)

- If your reply contains a handoff block:
  - Verify that the user explicitly requested a new handoff.
  - Verify that this is not the first user message in the thread.
  - Verify that the user’s message did not contain a prior handoff (title line “Handoff — …”) unless they explicitly asked for a new one.
  - If any check fails, suppress the handoff and proceed with normal startup.

Required structure (headings and order)

- Title line (first line inside the fence):
  - “Handoff — <project> for next thread”
  - Prefer the package.json “name” (e.g., “@org/pkg”) or another obvious repo identifier.
- Sections (in this order):
  1. Project signature (for mismatch guard)
     - package.json name
     - stanPath
     - Node version range or current (if known)
     - Primary docs location (e.g., “<stanPath>/system/”)
  2. Reasoning
     - Short bullets that capture current thinking, constraints/assumptions, and active decisions. The goal is to put the next session back on the same track; keep it factual and brief (no chain‑of‑thought).
  3. Unpersisted tasks
     - Short bullets for tasks that have been identified but intentionally not yet written to stan.todo.md or stan.project.md (tentative, thread‑scoped). Each item should be a single line.

Notes

- Do not repeat content that already lives in stan.todo.md or stan.project.md.
- The handoff policy is repo‑agnostic. Its content is for the next session’s assistant; avoid user‑facing checklists or instructions.
- Recognition rule (for non‑trigger): A “prior handoff” is any segment whose first non‑blank line begins with “Handoff — ” (with or without code fences). Its presence alone must not cause you to generate a new handoff.
- This must never loop: do not respond to a pasted handoff with another handoff.

# Always‑on prompt checks (assistant loop)

On every turn, perform these checks and act accordingly:

- System behavior improvements:
  - Do not edit `<stanPath>/system/stan.system.md`; propose durable behavior changes in `<stanPath>/system/stan.project.md` instead.
  - Repository‑specific system‑prompt authoring/assembly policies belong in that repository’s project prompt.

- Project prompt promotion:
  - When a durable, repo‑specific rule or decision emerges during work, propose a patch to `<stanPath>/system/stan.project.md` to memorialize it for future contributors.

- Requirements maintenance & separation guard:
  - STAN maintains durable requirements in `/<stanPath>/system/stan.requirements.md` and will propose patches to create/update it on demand when requirements evolve (developers MAY edit directly, but shouldn’t have to).
  - If requirements text appears in `stan.project.md`, or policy/prompt content appears in `stan.requirements.md`, propose a follow‑up patch to move the content to the correct file and keep the separation clean.

- Development plan update:
  - Whenever you propose patches, change requirements, or otherwise make a material update, you MUST update `<stanPath>/system/stan.todo.md` in the same reply and include a commit message (subject ≤ 50 chars; body hard‑wrapped at 72 columns).

Notes:

- CLI preflight already runs at the start of `stan run`, `stan snap`, and `stan patch`:
  - Detects system‑prompt drift vs packaged baseline and nudges to run `stan init` when appropriate.
  - Prints version and docs‑baseline information.
- File creation policy:
  - `stan init` does not create `stan.project.md` or `stan.requirements.md` by default. STAN creates or updates these files when they are needed.
- The “always‑on” checks above are assistant‑behavior obligations; they complement (not replace) CLI preflight.

## Monolith read‑only guidance

- Treat `<stanPath>/system/stan.system.md` as read‑only.
- If behavior must change, propose updates to `<stanPath>/system/stan.project.md` instead of editing the monolith.
- Local monolith edits are ignored when archives are attached, and CLI preflight will surface drift; avoid proposing diffs to the monolith.

## Mandatory documentation cadence (gating rule)

- If you emit any code Patch blocks, you MUST also (except deletions‑only or explicitly plan‑only replies):
  - Patch `<stanPath>/system/stan.todo.md` (add a “Completed (recent)” entry; update “Next up” if applicable).
  - Patch `<stanPath>/system/stan.project.md` when the change introduces/clarifies a durable requirement or policy.
- If a required documentation patch is missing, STOP and recompose with the missing patch(es) before sending a reply.

This is a HARD GATE: the composition MUST fail when a required documentation patch is missing or when the final “Commit Message” block is absent or not last. Correct these omissions and re‑emit before sending.

## Hard gates and diagnostics behavior

- 300‑LOC decomposition pivot:
  - Do NOT emit any patch that would make a file exceed 300 LOC; pivot to decomposition (File Ops multiple patches).
  - When producing Full Listings (diagnostics), if an affected file would exceed 300 LOC, pivot to decomposition and provide Full Listings for the decomposed files instead.
- Never mix a Patch and a Full Listing for the same file in the same turn.
- Patch‑failure replies:
  - Provide Full, post‑patch listings only (no patches) for each affected file (union across envelopes).
  - Do NOT emit a Commit Message in diagnostics replies.

## Dev plan document hygiene (content‑only)

- The development plan at `<stanPath>/system/stan.todo.md` MUST contain only the current plan content. Keep meta‑instructions, aliases, formatting/policy notes, process guidance, or “how to update the TODO” rules OUT of this file.
- “Completed” MUST be the final major section of the document.
- Allowed content in the TODO:
  - “Next up …” (near‑term actionable items).
  - “Completed” (final section; short, pruned list). New entries are appended at the bottom so their order of appearance reflects the order implemented. Do not edit existing Completed items.
  - Optional sections for short follow‑through notes or a small backlog (e.g., “DX / utility ideas (backlog)”).

- Append‑only logging for Completed:
  - Do NOT modify or rewrite a previously logged Completed item.
  - If follow‑on context is needed (e.g., clarifications/corrections), log it as a new list entry appended at the bottom instead of editing the original item.
  - These rules are enforced by pre‑send validation (see Response Format). A composition that edits prior Completed entries MUST fail and be re‑emitted as an end‑append only change.

- Prune for relevance:
  - Remove Completed items that are not needed to understand the work in flight (“Next up” and any active follow‑through). Retain only minimal context that prevents ambiguity.

- Numbering policy (dev plan):
  - Do NOT number items in the dev plan. Use nested headings/bullets for structure, and express priority/sequence by order of appearance.
  - Exception: a short, strictly ordered sub‑procedure may use a local numbered list where bullets would be ambiguous.

# Patch Policy (system‑level)

- Canonical patch path: /<stanPath>/patch/.patch; diagnostics: /<stanPath>/patch/.debug/
  - This directory is gitignored but always included in both archive.tar and archive.diff.tar.
- Patches must be plain unified diffs.
- Prefer diffs with a/ b/ prefixes and stable strip levels; include sufficient context.
- Normalize to UTF‑8 + LF. Avoid BOM and zero‑width characters.
- Forbidden wrappers: do not emit `*** Begin Patch`, `*** Add File:`, `Index:` or other non‑unified preambles; they are not accepted by `git apply` or `stan patch`.
- Tool preference & scope
  - File Ops are the preferred method for moving, copying, and deleting files or directories (single or bulk).
  - Diff Patches are the preferred method for creating files or changing them in place.
  - The one‑patch‑per‑file rule applies to Diff Patches only; File Ops are exempt and may cover many paths in one block.
- Combined workflow
  - When a file is moved and its imports/content must change, do both in one turn:
    1. File Ops: `mv old/path.ts new/path.ts`
    2. Diff Patch: `new/path.ts` with the required edits (e.g., updated imports)

# CRITICAL: Patch generation guidelines (compatible with “stan patch”)

- Format: plain unified diff. Strongly prefer git-style headers:
  - Start hunks with `diff --git a/<path> b/<path>`, followed by `--- a/<path>` and `+++ b/<path>`.
  - Use forward slashes in paths. Paths must be relative to the repo root.
- Strip level: include `a/` and `b/` prefixes in paths (STAN tries `-p1` then `-p0` automatically).
- Context: include at least 3 lines of context per hunk (the default). STAN passes `--recount` to tolerate line-number drift.
- Whitespace: do not intentionally rewrap lines; STAN uses whitespace‑tolerant matching where safe.
- New files / deletions:
  - New files: include a standard diff with `--- /dev/null` and `+++ b/<path>` (optionally `new file mode 100644`).
  - Deletions: include `--- a/<path>` and `+++ /dev/null` (optionally `deleted file mode 100644`).
- Renames: prefer delete+add (two hunks) unless a simple `diff --git` rename applies cleanly.
- Binary: do not include binary patches.
- One-file-per-patch in replies: do not combine changes for multiple files in a single unified diff block. Emit separate Patch blocks per file as required by Response Format.
  - This applies to Diff Patches. File Ops are exempt and may include multiple operations across files.

# Hunk hygiene (jsdiff‑compatible; REQUIRED)

- Every hunk body line MUST begin with one of:
  - a single space “ ” for unchanged context,
  - “+” for additions, or
  - “-” for deletions. Never place raw code/text lines (e.g., “ ),”) inside a hunk without a leading marker.
- Hunk headers and counts:
  - Use a valid header `@@ -<oldStart>,<oldLines> <newStart>,<newLines> @@`.
  - The body MUST contain exactly the number of lines implied by the header: • oldLines = count of “ ” + “-” lines, • newLines = count of “ ” + “+” lines.
  - Do not start a new `@@` header until the previous hunk body is complete.
- File grouping:
  - For each changed file, include one or more hunks under a single “diff --git … / --- … / +++ …” group.
  - Do not interleave hunks from different files; start a new `diff --git` block for the next file.
- Paths and strip:
  - Prefer `a/<path>` and `b/<path>` prefixes (p1). STAN will also try p0 automatically.
  - Paths must use POSIX separators “/” and be repo‑relative.
- Fences and prose:
  - Do not place markdown text, banners, or unfenced prose inside the diff. Keep the diff payload pure unified‑diff.
  - When presenting in chat, wrap the diff in a fence; the fence must not appear inside the diff body.
- Line endings:
  - Normalize to LF (`\n`) in the patch. STAN handles CRLF translation when applying.

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
