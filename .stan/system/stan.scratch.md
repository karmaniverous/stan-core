# STAN Scratch (short-term memory)

Last updated: 2026-01-25Z

## Current focus

- Adopt dependency context meta/state v2 (compact) end-to-end across STAN.
- Update stan-core to generate v2 `dependency.meta.json` (nodeId = archive address; externals normalized to staged `.stan/context/**` paths).
- Update stan-core to accept and validate v2 `dependency.state.json` (v=2, i/x, kindMask bitmask).
- Consume `summarizeDependencySelection` from stan-context for closure + deterministic sizing.
- Coordinate stan-cli to treat v2 meta/state as authoritative during `stan run -c`.

## Working model (high signal)

- The assistant must only ever see archive-addressable nodeIds (repo-relative paths); externals are always staged under `.stan/context/**`.
- Source OS paths are transient to `stan run -c` and must not be written into assistant-facing meta files.

## Decisions

- Breaking changes are acceptable; optimize for compactness and deterministic selection.
- Integrity checks use `size` + 128-bit sha256 prefix (base64url, no padding) as “good enough”.