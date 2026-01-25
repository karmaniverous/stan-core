# Dependency context v2 update: dependency.map.json, no hashes in assistant meta

We’re adjusting the dependency context v2 rollout to preserve assistant context budget:

- `.stan/context/dependency.meta.json` (v2 compact, assistant-facing) will omit content hashes entirely. It remains traversal + budgeting input (node kinds, sizes, descriptions, edges).
- `.stan/context/dependency.state.json` (v2 compact, assistant-authored) remains directives (v=2, i/x, kindMask).
- New host-private file: `.stan/context/dependency.map.json`
  - Regenerated on every `stan run -c` (ephemeral).
  - Canonical nodeId → locatorAbs + size + full sha256 for staging verification.
  - Not included in archives (allowlist selection).

We are keeping disk staging (Option A):

- During `stan run -c`, the host verifies external sources using `dependency.map.json` and then copies selected external bytes into `.stan/context/**` so they are archive-addressable for the assistant.

No immediate stan-cli implementation action is expected until stan-core + stan-context changes land, but please flag any concerns about:

- The file name/location `.stan/context/dependency.map.json`
- Any chance your meta-archive or base allowlist logic would accidentally include it (it must remain host-private).
