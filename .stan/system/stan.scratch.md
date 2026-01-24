# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Apply Radash across the stan-core codebase where it is a clear fit (replace home-grown or repeated “utility” patterns with radash equivalents).
- Keep lint + typecheck + tests green during the sweep (avoid strictFunctionTypes contravariance traps and `require-await` noise).

## Working model (high signal)

- For SSR robustness, use a shared resolver that prefers named exports and falls back to default properties (and optionally callable default export) with clear error messages.
- For generic utility needs (dedupe, select/filter, object shaping), prefer Radash over local ad-hoc implementations when semantics match; then remove redundant local helpers.

## Decisions

- Path normalization: Consolidate `isUnder` / `matchesPrefix` logic to use `src/stan/path/prefix.ts` everywhere. This ensures consistent POSIX handling and reduces duplicated normalization code.
