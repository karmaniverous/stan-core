# Interop request: helper to summarize selection closure + bytes

Context:

stan-core/stan-cli are implementing `--context` allowlist-only archiving, where the archive payload is budget-driven and derived from:

- Base (config-driven; meta/system + dependency meta + root base files),
- Plus the selected dependency closure from `dependency.state.json`,
- Minus explicit excludes (hard denials) and reserved denials/binaries (always).

Budgeting is deterministic but approximate:

- Treat `metadata.size` as bytes (proxy for characters).
- Estimate tokens as `bytes / 4`.
- Target selection is ~50% of usable context budget, with controlled extra expansion up to 65% if needed, then pruning back to target.

Problem:

Even if `dependency.meta.json` contains per-node `metadata.size`, consumers still need to compute:

1) The selected node set (closure membership) for a given state file, and
2) Aggregate sizing (sum of bytes, count of nodes), ideally with top contributors,

without reading all file bodies, and without baking per-node transitive summaries into the graph (which would bloat `dependency.meta.json`).

## Request: add an optional exported helper (no graph schema change required)

Please consider adding a helper API to `@karmaniverous/stan-context` (or a subpath export) that computes selection closure membership + aggregate sizes for a given state selection.

Proposed contract (shape only; naming is flexible):

- `summarizeDependencySelection({ graph, include, exclude, options }) -> summary`

Inputs:

- `graph`: the existing `DependencyGraph` returned by `generateDependencyGraph`.
- `include` / `exclude`: state entries in the same tuple forms used by STAN dependency state:
  - `string | [nodeId, depth] | [nodeId, depth, edgeKinds[]]`
- `options` (optional):
  - `defaultEdgeKinds` (when omitted in entries)
  - `dropKinds`: whether to omit `builtin`/`missing` node kinds from closure results (recommended default: omit them and surface them as warnings)
  - `maxTop`: number of top contributors to return (default small, deterministic)

Output summary:

- `selectedNodeIds: string[]` (sorted deterministically)
- `selectedCount: number`
- `totalBytes: number` (sum of `metadata.size` for selected nodes that have it; treat missing as 0 but report warnings)
- `largest: Array<{ nodeId: string; bytes: number }>` (top-N by bytes; deterministic tie-breaking)
- `warnings: string[]` (e.g., selected nodes missing `metadata.size`, builtin/missing nodes selected, etc.)

Notes:

- This helper should use the same deterministic traversal semantics as the state closure rules:
  - outgoing edges only
  - depth-limited BFS expansion
  - edgeKinds filtering
  - excludes win (subtract after includes using same traversal semantics)
- The goal is to let consumers generate deterministic “selection reports” (bytes/tokens estimates and prune suggestions) without inflating the graph meta or reimplementing closure logic across packages.

Non-goals:

- Do not add per-node transitive summaries to `dependency.meta.json` (too interpretation-dependent and would bloat meta).
- Do not perform tokenization inside stan-context.
