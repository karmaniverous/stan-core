# STAN Scratch (short-term memory)

Last updated: 2026-01-26Z (Termination Trigger)

## Current focus

- Updated context budgeting policy in requirements.
  - Switched from static "half of context" to dynamic "half of remaining context" targeting the diff size.
  - Added termination trigger: request new thread when context is insufficient for a useful dependency state update.

## Next step

- Resume TypeDoc coverage for library API (`src/**`).