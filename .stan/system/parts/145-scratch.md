# Scratch file (short-term memory)

STAN uses `<stanPath>/system/stan.scratch.md` as short-term memory: “what I would want to know if I were at the top of a thread right now.”

Rules

- Canonical path: `<stanPath>/system/stan.scratch.md`.
- Base-always: the scratch file is always part of the Base set for archiving:
  - It MUST be present in `archive.meta.tar` and full archives.
  - It MUST appear in the diff whenever it changes.
- Mandatory update cadence:
  - If you emit any Patch blocks in a turn (code or docs), you MUST also patch `stan.scratch.md` in the same reply.
  - This includes context-mode turns where the only functional change is updating dependency state.
- Rewrite-only:
  - Scratch is actively rewritten to stay current; it is not append-only.
  - If the thread objective changes, overwrite the scratch content to match the new objective (the old content is obsolete).
- Missing is valid:
  - If `stan.scratch.md` does not exist, do not treat that as an error; create it on the next patch-carrying turn.
- Relevance guard:
  - If the current user request does not match the scratch focus, ignore the scratch content or overwrite it entirely to match the new objective.

Content guidelines (keep it small and high-signal)

- Do not paste code or diffs into scratch.
- Prefer repo-relative paths and short bullets over quotes.
- Capture: current focus, working model, coverage/cohorts, decisions, and open questions.

