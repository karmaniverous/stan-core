# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- System prompt parts hygiene: remove invalid hard-wraps in `.stan/system/parts/*.md`, remove tar header integrity as an assistant obligation, and remove tool/validator references from the prompt text.
- Keep the follow-through focus: stan-cli wiring for `onSelectionReport` presentation (engine stays presentation-free).

## Working model (high signal)

- The system prompt is generated from `.stan/system/parts/*.md`; those parts must follow the repo-wide “no manual hard-wrap” Markdown policy to avoid self-contradiction.
- Dev plan “Completed” rule means: append-only within the Completed section; updating other sections (e.g., “Next up”) is allowed.

## Open questions

- Whether stan-cli should persist any selection report artifacts under `.stan/output/` (recommendation: no; present-only).
- Whether the report schema needs an opt-in “verbose” mode (recommendation: keep minimal; warnings already carry file lists).