# stan-core integration — summarizeDependencySelection + v2 bitmasks

We’re updating stan-core to adopt dependency context v2 (compact meta/state).

Requests / confirmations:

- Please confirm `summarizeDependencySelection` is exported from `@karmaniverous/stan-context` as documented in `guides/stan-assistant-guide.md`.
- Please confirm the helper supports state entries in both forms:
  - `edgeKinds: ('runtime'|'type'|'dynamic')[]` (v1-style)
  - `kindMask` bitmask (runtime=1, type=2, dynamic=4, all=7)
- Please confirm deterministic output guarantees (sorted `selectedNodeIds`, sorted `warnings`, stable `largest` ordering).

stan-core will:

- Normalize external nodeIds into staged `.stan/context/**` archive-addressable paths (no OS absolute paths in assistant-facing meta).
- Use `summarizeDependencySelection` for closure + byte sizing in context allowlist planning.

If you have a preferred minimal “graph” structural type for the helper input (nodes/edges fields required), please share it so stan-core can avoid any adapter guesswork.
