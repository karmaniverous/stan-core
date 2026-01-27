# STAN Scratch (short-term memory)

Last updated: 2026-01-27Z (Remove reply validator)

## Current focus

- Remove response/message validator from stan-core.
  - Rationale: `stan patch` only receives the patch payload a human chooses to copy, not the full assistant reply, so reply-level validation cannot be enforced mechanically.
  - Enforcement belongs in system-prompt rules + human gating (especially for dependency-state reasoning).

## Next step

- Resume TypeDoc coverage for the public engine API (`src/**`) after the breaking removal is released.