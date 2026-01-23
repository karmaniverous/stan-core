# STAN Scratch (short-term memory)

Last updated: 2026-01-23Z

## Current focus

- System prompt hygiene and de-duplication: consolidate overlapping rule blocks in `.stan/system/parts/*.md` to reduce drift.
- Remove deprecated archive-shaping language (anchors/facets) from the system prompt; upcoming major will eliminate them.
- Memorialize the File Ops “fenced for display, copied without fence markers” convention in `.stan/system/stan.project.md` so it is not treated as an implementation mismatch.
- Keep the follow-through focus on stan-cli wiring for `onSelectionReport` presentation (engine stays presentation-free).

## Working model (high signal)

- The system prompt monolith is assembled from `.stan/system/parts/*.md`; edit parts, then regenerate the monolith via tooling.
- Dev plan maintenance: keep `.stan/system/stan.todo.md` under 300 lines by pruning whole oldest Completed entries; do not rewrite retained Completed entries; keep Completed as the final major section.

## Open questions

- Whether stan-cli should persist any selection report artifacts under `.stan/output/` (recommendation: no; present-only).
- Whether the report schema needs an opt-in “verbose” mode (recommendation: keep minimal; warnings already carry file lists).