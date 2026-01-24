# STAN Scratch (short-term memory)

Last updated: 2026-01-24Z

## Current focus

- Update system prompt parts per stan-cli interop feedback: the Response Format post-compose checklist must explicitly enforce the scratch patch requirement.
- Strengthen system-level code-quality guardrails:
  - Aggressively avoid `any`; if unavoidable, pause for a design discussion, then use narrow scope and add inline rationale next to the `any`.
  - Avoid `eslint-disable`; if unavoidable, pause for a design discussion, then scope narrowly and add inline rationale next to the disablement.
- Clarify in `.stan/system/stan.project.md` that “update the system prompt” means updating `.stan/system/parts/*.md` and regenerating `.stan/system/stan.system.md`.

## Working model (high signal)

- Incoming interop note (read-only): `.stan/imports/stan-cli/20260124-190000Z-system-prompt-checklist-gap.md` requested adding scratch verification to the final gating checklist.

## Decisions

- After applying these patches, regenerate the monolith (`.stan/system/stan.system.md`) via the repo’s prompt assembly step (e.g., `tsx tools/gen-system.ts` or `npm run build`).