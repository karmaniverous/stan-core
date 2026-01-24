# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Finish the DRY pass across stan-core runtime + tests.
- Keep lint + Knip + typecheck clean while doing the sweep (avoid strict-function-types gotchas and `require-await` noise).
- Continue reducing test flake and repetition by standardizing temp-dir creation/cleanup (finish remaining mkdtemp/rm conversions).

## Working model (high signal)

- Prefer small, feature-scoped helpers over “god utils” (especially for path normalization where semantics differ).
- For SSR robustness, use a shared resolver that prefers named exports and falls back to default properties (and optionally callable default export) with clear error messages.
- For tests, use a common mkdtemp/cleanup helper to avoid Windows EBUSY/ENOTEMPTY flake.

## Open questions

- None; continue sweeping remaining tests/modules for duplicated helpers where semantics truly match.