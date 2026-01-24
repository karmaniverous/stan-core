# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Fix context-mode DX: avoid brittle TypeScript resolution failures in `stan run --context`.
- Implement TS injection pass-through in stan-core:
  - stan-core no longer imports/gates TypeScript for dependency graph mode.
  - stan-core passes host-injected `typescript` / `typescriptPath` through to stan-context.
  - stan-core externalizes `@karmaniverous/stan-context` to avoid bundling-related loader issues.
- Next: stan-cli should inject its own runtime TypeScript (module or resolved entry path) when invoking context mode.

## Working model (high signal)

- Root issue: relying on ambient `import('typescript')` resolution from inside bundled dependencies is brittle and yields poor error messages.
- Solution: host-provided TS injection (module or absolute `typescriptPath`) + stan-context-owned validation/error reporting.
- This matches future VS Code extension needs (IDE tsdk path) while keeping repo installs lightweight.

## Decisions

- Accept stan-context constraint: `typescriptPath` is loaded via `require()` and must be a CommonJS entry module; inject `typescript` module instead when only an ESM entrypoint exists.
- stan-core should support both `typescript` and `typescriptPath` pass-through and must not gate TS itself.