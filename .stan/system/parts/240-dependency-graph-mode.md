# Dependency graph mode (context expansion)

When dependency graph mode is enabled (via the CLI “context mode”), STAN uses a
dependency graph (“meta”) and a state file (“state”) to expand archived context
beyond the baseline repository selection.

This is designed to replace facet/anchor-based archive shaping as the primary
mechanism for context control.

## Canonical files and locations

Dependency artifacts (workspace; gitignored):
- Graph (assistant-facing): `.stan/context/dependency.meta.json`
- Selection state (assistant-authored): `.stan/context/dependency.state.json`
- Staged external files (engine-staged for archiving):
  - NPM/package deps: `.stan/context/npm/<pkgName>/<pkgVersion>/<pathInPackage>`
  - Absolute/outside-root deps: `.stan/context/abs/<sha256(sourceAbs)>/<basename>`

Archive outputs (under `.stan/output/`):
- `.stan/output/archive.tar` (full)
- `.stan/output/archive.diff.tar` (diff)
- `.stan/output/archive.meta.tar` (meta; only when context mode enabled)
  - Contains system files + dependency meta (not state; not staged payloads).

## Read-only staged imports (baseline rule)

Never create, patch, or delete any file under `.stan/imports/**`.

Imported content under `.stan/imports/**` is read-only context staged by tooling.
If a document exists both as an explicit import and as dependency-staged context,
prefer selecting the explicit `.stan/imports/**` copy in dependency state to
avoid archive bloat.

## When the assistant must act

When `dependency.meta.json` is present in the archive, treat dependency graph
mode as active for this thread.

When dependency graph mode is active, the assistant MUST update
`.stan/context/dependency.state.json` at the end of each normal (patch-carrying)
turn so the next run can stage the intended context expansion deterministically.

## State file schema (v1)

Concepts:
- `nodeId`: a repo-relative POSIX path.
  - Repo-local nodes: e.g., `src/index.ts`, `packages/app/src/a.ts`
  - Staged external nodes: e.g., `.stan/context/npm/zod/4.3.5/index.d.ts`
- `depth`: recursion depth (hops) along outgoing edges.
  - `0` means include only that nodeId (no traversal).
- `edgeKinds`: which edge kinds to traverse; default includes dynamic edges.

Types:

```ts
type DependencyEdgeType = 'runtime' | 'type' | 'dynamic';

type DependencyStateEntry =
  | string
  | [string, number]
  | [string, number, DependencyEdgeType[]];

type DependencyStateFile = {
  include: DependencyStateEntry[];
  exclude?: DependencyStateEntry[];
};
```

Defaults:
- If `depth` is omitted, it defaults to `0`.
- If `edgeKinds` is omitted, it defaults to `['runtime', 'type', 'dynamic']`.
- Excludes win over includes.

Semantics:
- Selection expands from each included entry by traversing outgoing edges up to
  the specified depth, restricted to the requested edge kinds.
- Exclude entries subtract from the final include set using the same traversal
  semantics (excludes win).

## Expansion precedence (dependency mode)

Dependency expansion is intended to expand the archive beyond the baseline selection by explicitly selecting additional node IDs via `dependency.state.json`.

- Explicit dependency selection MAY override:
  - `.gitignore` (gitignored files can be selected when explicitly requested)
- Explicit dependency selection MUST NOT override:
  - explicit `excludes` (hard denials)
  - reserved denials: `.git/**`, `<stanPath>/diff/**`, `<stanPath>/patch/**`, and archive outputs under `<stanPath>/output/**`
  - binary exclusion during archive classification

## Meta archive behavior (thread opener)

When context mode is enabled, tooling produces `.stan/output/archive.meta.tar`
in addition to the full and diff archives.

The meta archive is intended for the start of a thread:
- It contains system docs + dependency meta.
- It excludes dependency state and staged dependency payloads.
- The assistant should produce an initial `dependency.state.json` based on the
  prompt and then rely on full/diff archives for subsequent turns.

## Assistant guidance (anti-bloat)

- Prefer shallow recursion and explicit exclusions over deep, unconstrained
  traversal. Increase depth deliberately when required.
- Prefer `.stan/imports/**` paths when they satisfy the need; avoid selecting redundant `.stan/context/**` nodes unless the imported copy is incomplete or mismatched.