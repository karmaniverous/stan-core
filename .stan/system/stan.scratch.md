# STAN Scratch (short-term memory)

Last updated: 2026-01-25Z

## Current focus

- Adopt dependency context meta/state v2 (compact) end-to-end across STAN.
- Persist host-private `.stan/context/dependency.map.json` (ephemeral, regenerated each `stan run -c`) with canonical nodeId → locatorAbs + size + full sha256 for staging verification.
- Remove content hashes from assistant-facing `dependency.meta.json` (context preservation).
- Keep disk staging (Option A): stage selected externals into `.stan/context/**` as archive-addressable bytes for archiving and assistant use.
- Consume `summarizeDependencySelection` from stan-context for closure + deterministic sizing.
- Gather interop feedback from stan-context and stan-cli before implementation.

## Working model (high signal)

- The assistant must only ever see archive-addressable nodeIds (repo-relative paths); externals are always staged under `.stan/context/**`.
- OS source locators must not be written into assistant-facing meta; they live only in host-private `dependency.map.json` and are never archived.

## Decisions

- Breaking changes are acceptable; optimize for compactness and deterministic selection.
- Assistant-facing meta omits content hashes entirely.
- Staging verification uses full sha256 + size from `dependency.map.json`.