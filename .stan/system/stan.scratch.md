# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Fix context-mode DX: avoid brittle TypeScript resolution failures in `stan run --context`.
- Adopt “TypeScript injection” design:
  - Host provides TS explicitly as a path/provider (stan-cli now; IDE/repo later).
  - stan-context becomes the only component that directly cares about TS availability.
  - stan-core stops gating on TS presence and just threads host inputs through.

## Working model (high signal)

- Current failure mode: stan-core throws a generic “install typescript” error even when TS is present, likely due to dynamic import + bundling/resolution edge cases.
- Design goal: eliminate reliance on ambient package resolution for TS by letting the host pass an explicit TS entrypoint path (or loader).
- This matches future VS Code extension needs (IDE tsdk path) while keeping repo installs lightweight.

## Decisions

- Post an interop request to stan-context proposing `typescriptPath`/`typescriptRequired` (or a loader callback) on `generateDependencyGraph`, with actionable error reporting when required TS cannot be loaded.
- After stan-context supports injection, update stan-core and stan-cli to pass through the configured TS source (stan-cli dependency by default).
