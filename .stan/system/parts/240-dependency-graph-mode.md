# Dependency graph mode (context expansion)

When dependency graph mode is enabled (via the CLI “context mode”), STAN uses a dependency graph (“meta”) and a state file (“state”) to expand archived context beyond the baseline repository selection.

## Canonical files and locations

Dependency artifacts (workspace; gitignored):

- Graph (assistant-facing): `<stanPath>/context/dependency.meta.json`
- Selection state (assistant-authored; v2): `<stanPath>/context/dependency.state.json`
- Host-private integrity map (MUST NOT be archived): `<stanPath>/context/dependency.map.json`
- Staged external files (engine-staged for archiving):
  - NPM/package deps: `<stanPath>/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
  - Absolute/outside-root deps: `<stanPath>/context/abs/<sha256(sourceAbs)>/<basename>`

Archive outputs (under `<stanPath>/output/`):

- `<stanPath>/output/archive.tar` (full by default; META when `stan run --context --meta`)
- `<stanPath>/output/archive.diff.tar` (diff; written by `stan run` and by `stan run --context` (non-meta))
- In `stan run --context --meta`, `archive.diff.tar` is not written.
  - The META archive contains system files + dependency meta + dependency state (the host writes `{ "v": 2, "i": [] }` before archiving so the assistant starts from a clean slate).
  - It excludes staged payloads by omission and never includes `dependency.map.json` (host-private; reserved denial).

## Read-only staged imports (baseline rule)

Never create, patch, or delete any file under `<stanPath>/imports/**`.

Imported content under `<stanPath>/imports/**` is read-only context staged by tooling. If a document exists both as an explicit import and as dependency-staged context, prefer selecting the explicit `<stanPath>/imports/**` copy in dependency state to avoid archive bloat.

## When the assistant must act

Treat dependency graph mode as active if `dependency.meta.json` is present in the current archive **OR** has been observed previously in this thread (thread-sticky). Only treat it as inactive if a *full* archive explicitly shows it deleted.

When dependency graph mode is active and you emit any Patch blocks in a turn, you MUST do exactly one of:

- Patch `<stanPath>/context/dependency.state.json` with a real change (no no-op patches), or
- Make no dependency state change and include the exact line `dependency.state.json: no change` under `## Input Data Changes`.

No-op state patches are forbidden: do not emit a Patch for `dependency.state.json` unless the file contents change.

When you change dependency selection, also update `<stanPath>/system/stan.scratch.md` to capture WHY the selection changed.

## Acquiring additional in-repo context (HARD RULE)

When dependency graph mode is active and `dependency.meta.json` contains a useful candidate nodeId for the code you need, you MUST request that code via `<stanPath>/context/dependency.state.json` and a new `stan run --context` archive/diff. You MUST NOT ask the user to paste file contents for in-repo files in this case.

Default behavior:

- If an error log references repo-relative paths (for example, `src/...`) that are not present in the current archive, seed `dependency.state.json` with those paths (depth 0–1) and request a new `--context` archive/diff.

Allowed exceptions:

- The file contents are already present in the currently attached archive.
- The user explicitly declines running another archive cycle and insists on manual paste.
- The target cannot be staged via dependency selection (outside the repo/graph).

## Target-file availability checklist (MANDATORY)

When dependency graph mode is active and your reply includes any Patch that targets a path outside `<stanPath>/system/**`, you MUST include a checklist under `## Input Data Changes`:

- Patch targets (outside `<stanPath>/system/**`; present in current archive):
  - `<path>` — present: `yes|no`
- Dependency selection (seed entries only; do not expand closure):
  - If you patch `<stanPath>/context/dependency.state.json` in this reply, list the include (`i`) and exclude (`x`) entries exactly as written (string or tuple forms).
  - Otherwise include the exact line `dependency.state.json: no change`.

Hard gate:

- If any listed patch target is `present: no`, you MUST NOT emit patches for those files in this turn.
- Instead, emit only patches for `<stanPath>/context/dependency.state.json` (to stage the missing files), `<stanPath>/system/stan.scratch.md` (WHY), `<stanPath>/system/stan.todo.md`, and a commit message, then request a new `stan run --context` archive/diff.

## State file schema (v2)

Concepts:

- `nodeId`: a repo-relative POSIX path (the archive address).
  - Repo-local nodes: e.g., `src/index.ts`, `packages/app/src/a.ts`
  - Staged external nodes: e.g., `<stanPath>/context/npm/zod/4.3.5/index.d.ts`
- `depth`: recursion depth (hops) along outgoing edges (`0` means seed only; no traversal).
- `kindMask`: which edge kinds to traverse (bitmask).
  - runtime = `1`
  - type = `2`
  - dynamic = `4`
  - all = `7`

Types:

~~~~ts
type DependencyStateEntryV2 =
  | string
  | [string, number]
  | [string, number, number];

type DependencyStateFileV2 = {
  v: 2;
  i: DependencyStateEntryV2[];
  x?: DependencyStateEntryV2[]; // excludes win
};
~~~~

Defaults:

- If `depth` is omitted, it defaults to `0`.
- If `kindMask` is omitted, it defaults to `7` (runtime + type + dynamic).
- Excludes win over includes.

Semantics:

- Selection expands from each included entry by traversing outgoing edges up to the specified depth, restricted to `kindMask`.
- Exclude entries subtract from the final include set using the same traversal semantics (excludes win).

## Expansion precedence (dependency mode)

Dependency expansion is intended to expand the archive beyond the baseline selection by explicitly selecting additional node IDs via `dependency.state.json`.

- Explicit dependency selection MAY override: `.gitignore` (gitignored files can be selected when explicitly requested)
- Explicit dependency selection MUST NOT override: explicit `excludes` (hard denials), reserved denials (`.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`, and archive outputs under `<stanPath>/output/**`), or binary exclusion during archive classification

## Meta archive behavior (thread opener)

In `stan run --context --meta`, tooling produces a META archive at `<stanPath>/output/archive.tar` and does not write a diff archive.

The META archive is intended for the start of a thread:

- It contains system docs + `dependency.meta.json` + `dependency.state.json` (v2 empty written by the host).
- It excludes staged dependency payloads by omission.
- After the thread is started, `stan run --context` (non-meta) writes BOTH a FULL allowlist context archive (`archive.tar`) and a DIFF allowlist context archive (`archive.diff.tar`) for subsequent turns.

## Assistant guidance (anti-bloat)

- Prefer shallow recursion and explicit exclusions over deep, unconstrained traversal. Increase depth deliberately when required.
- Prefer `<stanPath>/imports/**` paths when they satisfy the need; avoid selecting redundant `<stanPath>/context/**` nodes unless the imported copy is incomplete or mismatched.

## Editing Safety (CRITICAL)

- When you know a file exists (e.g., via `dependency.meta.json`) but it has not been loaded into the thread via an archive, you MUST NOT attempt to edit it.
- Always load files into the thread (by updating `dependency.state.json` or `includes`) before editing them.
