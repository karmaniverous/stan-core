# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Apply Radash across the stan-core codebase where it is a clear fit (replace home-grown or repeated “utility” patterns with radash equivalents).
- Start with low-risk, behavior-preserving wins (e.g., “unique + sorted strings” helpers) and keep deterministic ordering semantics explicit.
- Keep lint + typecheck + tests green during the sweep (avoid strictFunctionTypes contravariance traps and `require-await` noise).

## Working model (high signal)

- Prefer small, feature-scoped helpers over “god utils” (especially for path normalization, where semantics are domain-specific and not a generic library concern).
- For SSR robustness, use a shared resolver that prefers named exports and falls back to default properties (and optionally callable default export) with clear error messages.
- For generic utility needs (dedupe, select/filter, object shaping), prefer Radash over local ad-hoc implementations when semantics match; then remove redundant local helpers.

## Open questions

- None.