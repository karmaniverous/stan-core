# Dependency graph module descriptions (HARD RULE)

Purpose:

- Dependency graph node descriptions are a critical signal for selecting and traversing modules; they exist to help an assistant decide whether to include a module and whether to traverse its dependencies.

Hard rule (every code module):

- Every code module MUST begin with a TSDoc block using the appropriate tag:
  - Use `@packageDocumentation` for package entrypoints intended as public surfaces.
  - Use `@module` for normal modules.
- The docblock MUST appear at the head of the module (before imports/exports).
- The docblock MUST include prose (tag-only blocks are not acceptable).

Truncation-aware authoring (optimize the first 160 chars):

- Assume descriptions are truncated to the first 160 characters.
- Pack the highest-signal selection/traversal information into the first 160 characters:
  - What the module does (verb + object).
  - Whether it performs IO or has side effects (fs/process/network/child_process).
  - Whether it is a barrel/entrypoint, service, adapter, or pure helper.
  - A traversal hint (for example, “traverse runtime deps”, “type-only surface”, “adapter boundary”).

Examples:

Good (high-signal first 160 chars):

- “Validates dependency selections for undo/redo; reads files and hashes bytes; no network; traverse runtime+type deps only.”
- “Barrel export for context mode public API; re-exports types/functions; no side effects; include when working on context APIs.”

Bad (low-signal):

- “Utilities.”
- “Helper functions.”
- “Stuff for STAN.”

Enforcement (recommended):

- Repositories SHOULD enable an ESLint rule to enforce presence of module descriptions so this never regresses.
