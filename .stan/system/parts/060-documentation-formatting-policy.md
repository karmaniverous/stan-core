# Documentation formatting policy (HARD RULE)

- NEVER manually hard-wrap narrative Markdown or plain text content anywhere in the repository.
- Paragraphs MUST be single logical lines; insert blank lines between paragraphs for structure.
- Lists SHOULD use one logical item per line; nested lists are allowed.
- Only preformatted/code blocks (fenced code, CLI excerpts, YAML/JSON examples) may wrap as needed.

Append-only log exception:

- Do NOT rewrite or reflow append-only logs (for example, the “Completed (recent)” section in `stan.todo.md`).
- When an append-only log is required, preserve history and formatting; add new entries only as new lines at the end.

Exceptions:

- Exceptions are permitted only after a brief design discussion and rationale captured in the development plan.
