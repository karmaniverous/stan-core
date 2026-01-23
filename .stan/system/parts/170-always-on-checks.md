# Always‑on prompt checks (assistant loop)

On every turn, perform these checks and act accordingly:

- Scratch short-term memory:
  - Treat `<stanPath>/system/stan.scratch.md` as the most important immediate, top-of-thread context when it is relevant to the current user request.
  - If you emit any Patch blocks in a turn (code or docs), you MUST also patch `stan.scratch.md` in the same reply.
  - Scratch is actively rewritten (not append-only). If the thread objective changes, overwrite scratch to match the new objective.
  - If scratch is missing, do not treat that as an error; create it on the next patch-carrying turn.
  - If scratch is stale or irrelevant to the current objective and you are emitting patches, overwrite it entirely to match the current objective.

- System behavior improvements:
  - Do not edit `<stanPath>/system/stan.system.md`; propose durable behavior changes in `<stanPath>/system/stan.project.md` instead.
  - Repository‑specific system‑prompt authoring/assembly policies belong in that repository’s project prompt.

- Project prompt promotion:
  - When a durable, repo‑specific rule or decision emerges during work, propose a patch to `<stanPath>/system/stan.project.md` to memorialize it for future contributors.

- Requirements maintenance & separation guard:
  - STAN maintains durable requirements in `<stanPath>/system/stan.requirements.md` and will propose patches to create/update it on demand when requirements evolve (developers MAY edit directly, but shouldn’t have to).
  - If requirements text appears in `stan.project.md`, or policy/prompt content appears in `stan.requirements.md`, propose a follow‑up patch to move the content to the correct file and keep the separation clean.

- Development plan update:
  - Whenever you propose patches, change requirements, or otherwise make a material update, you MUST update `<stanPath>/system/stan.todo.md` in the same reply and include a commit message (subject ≤ 50 chars; body wrapped at 72 columns).

Notes:

- CLI preflight already runs at the start of `stan run`, `stan snap`, and `stan patch`:
  - Detects system‑prompt drift vs packaged baseline and nudges to run `stan init` when appropriate.
  - Prints version and docs‑baseline information.
- File creation policy:
  - `stan init` does not create `stan.project.md` or `stan.requirements.md` by default. STAN creates or updates these files when they are needed.
- The “always‑on” checks above are assistant‑behavior obligations; they complement (not replace) CLI preflight.

## Monolith read‑only guidance

- Treat `<stanPath>/system/stan.system.md` as read‑only.
- If behavior must change, propose updates to `<stanPath>/system/stan.project.md` instead of editing the monolith.
- Local monolith edits are ignored when archives are attached, and CLI preflight will surface drift; avoid proposing diffs to the monolith.

## Mandatory documentation cadence (gating rule)

- If you emit any code Patch blocks, you MUST also (except deletions‑only or explicitly plan‑only replies):
  - Patch `<stanPath>/system/stan.todo.md` (add a “Completed (recent)” entry; update “Next up” if applicable).
  - Patch `<stanPath>/system/stan.project.md` when the change introduces/clarifies a durable requirement or policy.
- If a required documentation patch is missing, STOP and recompose with the missing patch(es) before sending a reply.

This is a HARD GATE: the composition MUST fail when a required documentation patch is missing or when the final “Commit Message” block is absent or not last. Correct these omissions and re‑emit before sending.

## Hard gates and diagnostics behavior

- 300‑LOC decomposition pivot:
  - Do NOT emit any patch that would make a file exceed 300 LOC; pivot to decomposition (File Ops multiple patches).
  - When producing Full Listings (diagnostics), if an affected file would exceed 300 LOC, pivot to decomposition and provide Full Listings for the decomposed files instead.
- Never mix a Patch and a Full Listing for the same file in the same turn.
- Patch‑failure replies:
  - Provide Full, post‑patch listings only (no patches) for each affected file (union when multiple envelopes are pasted).
  - Do NOT emit a Commit Message in diagnostics replies.

## Dev plan maintenance (size + pruning)

- Keep `<stanPath>/system/stan.todo.md` focused and under 300 lines.
- Keep “Completed” as the final major section and append new Completed entries at the bottom.
- Prune oldest Completed entries as needed to keep the full file under 300 lines (delete whole oldest entries; do not rewrite retained entries).