# Dependency context v2 update: dependency.map.json, no hashes in assistant meta

We’re proceeding with dependency context v2 end-to-end and adjusting the split between assistant-facing and host-private artifacts:

- Assistant-facing:
  - `.stan/context/dependency.meta.json` (v2 compact) remains the Map for traversal and budgeting, but will omit content hashes entirely to preserve LLM context budget.
  - `.stan/context/dependency.state.json` (v2 compact) remains the Directives (v=2, i/x, kindMask bitmask).
- Host-private (ephemeral, regenerated each `stan run -c`):
  - `.stan/context/dependency.map.json` contains canonical nodeId → locatorAbs + size + full sha256 (bytes) for staging verification.

We will keep disk staging (Option A):

- Selected externals are verified via `dependency.map.json` and then copied into `.stan/context/**` so they become archive-addressable bytes for the assistant.

We will continue consuming `summarizeDependencySelection` for closure + deterministic byte sizing by inflating our compact v2 meta into the `DependencyGraph` shape (edges can use `resolution: 'explicit'` since traversal ignores resolution today).

Questions for stan-context:

- Any objections to moving content hashes out of assistant-facing meta and into a host-private `dependency.map.json` file?
- Confirm stan-context continues to produce raw graph nodes with reliable `metadata.size` and `metadata.hash` (full sha256) for file nodes; we’ll persist that into `dependency.map.json` during `stan run -c`.
