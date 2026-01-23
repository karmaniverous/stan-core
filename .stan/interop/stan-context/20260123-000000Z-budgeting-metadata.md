# Interop request: dependency.meta.json sizing for context budgeting

We are implementing `--context` allowlist-only archiving in stan-core/stan-cli so STAN can operate in repositories where a full project archive would exceed model context limits.

In this mode, assistant selection is budget-driven:

- We estimate tokens as `bytes / 4` (treat bytes as a proxy for characters).
- Target archive payload size is ~50% of usable context budget, with controlled extra expansion up to 65% when needed for sufficiency, then pruning back to target.

To make this deterministic, stan-core/stan-cli need to compute approximate selection size from `dependency.meta.json` without reading every file body.

## Requirement: `metadata.size` must be bytes (stable semantics)

Please confirm and/or guarantee the following contract for `graph.nodes[nodeId].metadata.size` in `generateDependencyGraph` output:

- Units: `metadata.size` is the file size in bytes (not characters), as observed on disk for the scanned file.
- Source of truth: the value reflects the on-disk working tree bytes that would be archived (no pre-normalization such as EOL rewriting).
- Presence: for any node where `metadata.hash` is present (source/external nodes), `metadata.size` must also be present.
- Coverage: `metadata.size` should be populated for all scanned nodes that represent real files (repo-local and resolved external files), including non-code files that participate in the Universe scan.
- Determinism: values should be deterministic for a given working tree and platform, and the overall graph remains deterministically ordered (as it is today).

We are intentionally treating bytes as a proxy for characters for budgeting; we do not require a separate characters field.

## What we are NOT requesting

- No change to tunneling, edge classification, node IDs, or the graph schema beyond clarifying/guaranteeing `metadata.size` semantics.
- No token counting inside stan-context.

## Nice-to-have (documentation)

- If not already explicit in the stan-context docs/assistant guide, please document that `metadata.size` is bytes (and that consumers may use `bytes/4` as an approximate token heuristic).
