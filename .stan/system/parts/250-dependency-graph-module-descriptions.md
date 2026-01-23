# Dependency graph module descriptions (HARD RULE)

Purpose:

- Dependency graph node descriptions are a critical signal for selecting and traversing modules; they exist to help an assistant decide whether to include a module and whether to traverse its dependencies.

Hard rule (every non-test code module):

- Every code module MUST begin with a TSDoc block using the appropriate tag:
  - Use `@packageDocumentation` for package entrypoints intended as public surfaces.
  - Use `@module` for normal modules.
- The docblock MUST appear at the head of the module (before imports/exports).
- The docblock MUST include prose (tag-only blocks are not acceptable).

Test file exemption (baseline rule)

- Module/package docblocks are required in all non-test code modules.
- Test files are exempt (unit tests, specs, fixtures, and harnesses).
- Test-like paths are defined by these patterns (across TS/JS-like extensions):
  - `**/*.test.*`
  - `**/*.spec.*`
  - `**/__tests__/**`
  - `**/test/**`
  - `**/tests/**`
- This exemption is intended to reduce noise: module-level descriptions are generally low-signal in tests and can bloat dependency-graph context unnecessarily.
- If a project explicitly wants module docblocks in tests, it may override its lint config to enforce them.

Truncation-aware authoring (optimize the first 160 chars):

- Assume descriptions are truncated to the first 160 characters.
- Pack the highest-signal selection/traversal information into the first 160 characters:
  - What the module does (verb + object).
  - Whether it performs IO or has side effects (fs/process/network/child_process).
  - Whether it is a barrel/entrypoint, service, adapter, or pure helper.
  - A traversal hint (for example, “traverse runtime deps”, “type-only surface”, “adapter boundary”).

Docblock structure and formatting (HARD RULE)

- The module docblock MUST be a proper multi-line JSDoc/TSDoc block, not a single-line `/** @module ... */` inline tag.
- The tag MUST appear under the prose content (tag goes after content), and MUST be on its own line.
- When merging existing top-of-file prose into a new `@module`/`@packageDocumentation` docblock, the tag line MUST remain at the bottom of the merged docblock content (after all prose).
- Prose in code comments MUST be wrapped at 80 characters (this does not conflict with the Markdown no-wrap policy, which applies to Markdown/text only).
- If the file already has a top-of-file header comment, merge that intent into the tagged docblock so the tagged docblock remains the first comment in the file.
- Keep the first ~160 characters high-signal for dependency-graph navigation (what/IO/role/traversal hints).

Canonical example (correct)

~~~~ts
/**
 * Validates assistant reply format (patch blocks, commit message, optional
 * File Ops); pure string parsing; no IO; used by tooling.
 * @module
 */
~~~~

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
