# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Continue the DRY pass across stan-core runtime + tests.
- Keep lint + Knip + typecheck clean while doing the sweep (avoid strict-function-types gotchas and `require-await` noise).
- Apply the new system-level “do not reinvent the wheel” directive: prefer established, type-safe, tree-shakable dependencies (e.g., radash, zod) for well-traveled problems.

## Working model (high signal)

- Prefer small, feature-scoped helpers over “god utils” (especially for path normalization where semantics differ).
- For SSR robustness, use a shared resolver that prefers named exports and falls back to default properties (and optionally callable default export) with clear error messages.
- For tests, use a common mkdtemp/cleanup helper to avoid Windows EBUSY/ENOTEMPTY flake.

## Open questions

- None; continue sweeping remaining tests/modules for duplicated helpers where semantics truly match.