# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Ensure stan-core’s human-facing docs clearly state the TypeScript injection contract for context/dependency graph mode (without duplicating stan-context docs).
- Add a short README section: `buildDependencyMeta(...)` requires host-provided `typescript` or `typescriptPath`; stan-core only passes through to stan-context and does not resolve TS itself.

## Working model (high signal)

- TS injection is a host responsibility (stan-cli/IDE/service). stan-core stays presentation-free and avoids brittle ambient module resolution by delegating validation/errors to stan-context.
- Documentation should make the stan-core boundary explicit: “pass-through only; errors originate from stan-context.”

## Decisions

- Keep stan-core docs minimal and stan-core-specific; defer full injection semantics and constraints to stan-context documentation.
- Treat missing injection as a caller configuration error; surface (do not wrap) stan-context’s thrown error.