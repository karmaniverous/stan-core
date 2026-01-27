# Dependency graph mode (context expansion)

When dependency graph mode is enabled (via the CLI “context mode”), STAN uses a dependency graph (“meta”) and a state file (“state”) to expand archived context beyond the baseline repository selection.

## Canonical files and locations

Dependency artifacts (workspace; gitignored):

- Graph (assistant-facing): `.stan/context/dependency.meta.json`
- Selection state (assistant-authored; v2): `.stan/context/dependency.state.json`
- Host-private integrity map (MUST NOT be archived): `.stan/context/dependency.map.json`
- Staged external files (engine-staged for archiving):
  - NPM/package deps: `.stan/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
  - Absolute/outside-root deps: `.stan/context/abs/<sha256(sourceAbs)>/<basename>`

Archive outputs (under `.stan/output/`):

- `.stan/output/archive.tar` (full)
- `.stan/output/archive.diff.tar` (diff)
- `.stan/output/archive.meta.tar` (meta; only when context mode enabled)
  - Contains system files + dependency meta; omits dependency state always (clean slate for selections).
  - Excludes staged payloads by omission.
  - Never includes `dependency.map.json` (host-private; reserved denial).

## Read-only staged imports (baseline rule)

Never create, patch, or delete any file under `.stan/imports/**`.

Imported content under `.stan/imports/**` is read-only context staged by tooling. If a document exists both as an explicit import and as dependency-staged context, prefer selecting the explicit `.stan/imports/**` copy in dependency state to avoid archive bloat.

## When the assistant must act

Treat dependency graph mode as active if `dependency.meta.json` is present in the current archive **OR** has been observed previously in this thread (thread-sticky). Only treat it as inactive if a *full* archive explicitly shows it deleted.

When dependency graph mode is active and you emit any Patch blocks in a turn, you MUST do exactly one of:

- Patch `.stan/context/dependency.state.json` with a real change (no no-op patches), or
- Make no dependency state change and include the exact line `dependency.state.json: no change` under `## Input Data Changes`.

No-op state patches are forbidden: do not emit a Patch for `dependency.state.json` unless the file contents change.

When you change dependency selection, also update `<stanPath>/system/stan.scratch.md` to capture WHY the selection changed.

## State file schema (v2)

Concepts:

- `nodeId`: a repo-relative POSIX path (the archive address).
  - Repo-local nodes: e.g., `src/index.ts`, `packages/app/src/a.ts`
  - Staged external nodes: e.g., `.stan/context/npm/zod/4.3.5/index.d.ts`
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

When context mode is enabled, tooling produces `.stan/output/archive.meta.tar` in addition to the full and diff archives.

The meta archive is intended for the start of a thread:

- It contains system docs + dependency meta.
- It omits dependency state always (clean slate for selections).
- It excludes staged dependency payloads by omission.
- The assistant should produce an initial `dependency.state.json` based on the prompt and then rely on full/diff archives for subsequent turns.

## Assistant guidance (anti-bloat)

- Prefer shallow recursion and explicit exclusions over deep, unconstrained traversal. Increase depth deliberately when required.
- Prefer `.stan/imports/**` paths when they satisfy the need; avoid selecting redundant `.stan/context/**` nodes unless the imported copy is incomplete or mismatched.

## Editing Safety (CRITICAL)

- When you know a file exists (e.g., via `dependency.meta.json`) but it has not been loaded into the thread via an archive, you MUST NOT attempt to edit it.
- Always load files into the thread (by updating `dependency.state.json` or `includes`) before editing them.