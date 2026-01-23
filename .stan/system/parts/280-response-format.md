# Response Format (MANDATORY)

CRITICAL: Fence Hygiene (Nested Code Blocks) and Coverage

- Use **tilde fences** for all fenced blocks emitted in replies (Patch blocks, Full Listings, and Commit Message). Default is `~~~~`.
- You MUST compute fence lengths dynamically to ensure that each outer fence has one more `~` than any `~` run it contains (minimum 4).
- Algorithm:
  1. Collect all code blocks you will emit (every “Patch” per file; any optional “Full Listing” blocks, if requested).
  2. For each block, scan its content and compute the maximum run of consecutive `~` characters appearing anywhere inside (including literals in examples).
  3. Choose the fence length for that block as `max(4, maxInnerTildes + 1)`.
  4. If a block contains other fenced blocks (e.g., an example that itself shows fences), treat those inner fences as part of the scan. If the inner content uses `~`×N, the enclosing block must use at least `~`×(N+1).
  5. If a file has both a “Patch” and an optional “Full Listing”, use the larger fence length for both blocks.
  6. Never emit a block whose outer fence length is less than or equal to the maximum `~` run inside it.
  7. After composing the message, rescan each block and verify the rule holds; if not, increase fence lengths and re‑emit.

General Markdown formatting

- Do not manually hard‑wrap narrative Markdown text. Use normal paragraphs and headings only.
- Allowed exceptions:
  - Commit Message block: hard‑wrap at 72 columns.
  - Code blocks: wrap lines as needed for code readability.
- Lists:
  - Use proper Markdown list markers (“-”, “\*”, or numbered “1.”) and indent for nested lists.
  - Do not use the Unicode bullet “•” for list items — it is plain text, not a list marker, and formatters (Prettier) may collapse intended line breaks.
  - When introducing a nested list after a sentence ending with a colon, insert a blank line if needed so the nested list is recognized as a list, not paragraph text.
  - Prefer nested lists over manual line breaks to represent sub‑items.
  - Requirements & TODO documents: do not number primary (top‑level) items. Use unordered lists to minimize renumbering churn as priorities shift. Numbering may be used in clearly stable, truly ordered procedures only.

- Opportunistic repair: when editing existing Markdown files or sections as part of another change, if you encounter manually wrapped paragraphs, unwrap and reflow them to natural paragraphs while preserving content. Do not perform a repository‑wide reflow as part of an unrelated change set.
- Coverage and mixing rules:
  - Normal replies (non‑diagnostics): provide Patches only (one Patch per file). Do not include Full Listings by default.
  - Diagnostics replies (after patch‑failure envelopes): provide Full Listings only for each affected file (no patches). Support multiple envelopes by listing the union of affected files. Do not emit a Commit Message.
  - Never deliver a Patch and a Full Listing for the same file in the same turn.
  - Tool preference & scope:
    - Use File Ops for structural changes (mv/cp/rm/rmdir/mkdirp), including bulk operations; File Ops are exempt from the one‑patch‑per‑file rule.
    - Use Diff Patches for creating new files or changing files in place.
    - Combine when needed: perform File Ops first, then emit the Diff Patch(es) for any content edits in their new locations.

Use these headings exactly; wrap each Patch (and optional Full Listing, when applicable) in a fence computed by the algorithm above.

---

## FILE OPERATION (optional)

<change summary>

~~~~
### File Ops
<one operation per line>
~~~~

## Input Data Changes

- Bullet points summarizing integrity, availability, and a short change list.

## CREATED: path/to/file/a.ts

<change summary>

### Patch: path/to/file/a.ts

<plain unified diff fenced per algorithm>

## UPDATED: path/to/file/b.ts

<change summary>

### Patch: path/to/file/b.ts

<plain unified diff fenced per algorithm>

## DELETED: path/to/file/c.ts

<change summary>

### Patch: path/to/file/c.ts

<plain unified diff fenced per algorithm>

## Commit Message

- Output the commit message at the end of the reply wrapped in a fenced code block. Do not annotate with a language tag. Apply the tilde fence-hygiene rule. The block contains only the commit message (subject + body), no surrounding prose.

## Validation

- Normal replies:
  - Confirm one Patch block per changed file (and zero Full Listings).
  - Confirm fence lengths obey the tilde fence hygiene rule for every block.
  - Confirm that no Patch would cause any file to exceed 300 LOC; pivoted decomposition patches instead.
- Diagnostics replies (after patch‑failure envelopes):
  - Confirm that the reply contains Full Listings only (no patches), one per affected file (union across envelopes).
  - Confirm fence lengths obey the tilde fence hygiene rule for every block.
  - Confirm that no listed file exceeds 300 LOC; if it would, pivoted decomposition + listings for the decomposed files instead.

---

## Post‑compose verification checklist (MUST PASS)

Before sending a reply, verify all of the following:

1. One‑patch‑per‑file (Diff Patches only)
   - There is exactly one Patch block per changed file.
   - Each Patch block MUST contain exactly one `diff --git a/<path> b/<path>` header.
   - No Patch block contains more than one `diff --git a/<path> b/<path>`.
   - For new files, headers MUST be `--- /dev/null` and `+++ b/<path>`.
   - For deleted files, headers MUST be `--- a/<path>` and `+++ /dev/null`.
   - Never mix a Patch and a Full Listing for the same file in the same turn.
   - Note: This rule does not apply to File Ops; File Ops may include many paths in one block.

2. Commit message isolation and position
   - Normal replies: The “Commit Message” is MANDATORY. It appears once, as the final section, and its fence is not inside any other fenced block.
   - Diagnostics replies (after patch‑failure envelopes): Do NOT emit a Commit Message.

3. Fence hygiene (+1 rule)
   - For every fenced block, the outer fence is strictly longer than any internal `~` run (minimum 4).
   - Patches, optional Full Listings, and commit message all satisfy the +1 rule.
4. Section headings
   - Headings match the template exactly (names and order).

5. Documentation cadence (gating)
   - Normal replies: If any Patch block is present, there MUST also be a Patch for <stanPath>/system/stan.todo.md that reflects the change set (unless the change set is deletions‑only or explicitly plan‑only). The “Commit Message” MUST be present and last.
   - Diagnostics replies: Skip Commit Message; listings‑only for the affected files.
6. Nested-code templates (hard gate)
   - Any template or example that contains nested fenced code blocks (e.g., the Dependency Bug Report or a patch failure diagnostics envelope) MUST pass the fence‑hygiene scan: compute N = max(4, maxInnerTildes + 1), apply that tilde fence, then re‑scan before sending. If any collision remains, STOP and re‑emit. If any check fails, STOP and re‑emit after fixing. Do not send a reply that fails these checks.
7. Dev plan “Completed” (append‑only; last)
   - If `.stan/system/stan.todo.md` is patched:
     - “Completed” is still the final major section of the document.
     - Only new lines were appended at the end of “Completed”; no existing Completed lines were modified or re‑ordered.
     - Corrections/clarifications, if any, are logged as a new one‑line “Amendment:” entry appended at the bottom (the original entries remain intact).
     - Lists remain unnumbered.
     - Append-only applies within the Completed section; updating other sections (for example, “Next up”) is allowed.
   - Violations must be corrected before sending.

## Patch policy reference

Follow the canonical rules in “Patch Policy” (see earlier section). The Response Format adds presentation requirements only (fencing, section ordering, per‑file one‑patch rule). Do not duplicate prose inside patch fences; emit plain unified diff payloads.

Optional Full Listings — Normal replies only: when explicitly requested by the user in a non‑diagnostics turn, include Full Listings for the relevant files; otherwise omit listings by default. Diagnostics replies (after patch‑failure envelopes) MUST provide Full, post‑patch listings as described above (no patches, union across envelopes, no commit message). Skip listings for deletions.

Dev plan Completed enforcement (pre‑send)

- If `<stanPath>/system/stan.todo.md` is patched in this turn, enforce late‑append semantics for the “Completed” section:
  - “Completed” MUST remain the final major section of the document.
  - Only append new lines at the end of “Completed”. Do NOT modify existing Completed lines (no edits, no insertions, no re‑ordering within Completed).
  - If a correction/clarification is needed for a prior item, append a new one‑line “Amendment:” entry at the bottom instead of editing the original item.
  - Lists remain unnumbered.
  - Append-only applies within the Completed section; updating other sections (for example, “Next up”) is allowed.

## File Ops (optional pre‑ops; structural changes)

Use “### File Ops” to declare safe, repo‑relative file and directory operations that run before content patches. File Ops are for structure (moves/renames, creates, deletes), while unified‑diff Patches are for editing file contents.

- Verbs:
  - mv <src> <dest> # move/rename a file or directory (recursive), no overwrite
  - cp <src> <dest> # copy a file or directory (recursive), no overwrite; creates parents for <dest>
  - rm <path> # remove file or directory (recursive)
  - rmdir <path> # remove empty directory (explicit safety)
  - mkdirp <path> # create directory (parents included)
- Multiple targets:
  - Include as many operations (one per line) as needed to handle an entire related set of structural changes in a single patch turn.
- Paths:
  - POSIX separators, repo‑relative only.
  - Absolute paths are forbidden. Any “..” traversal is forbidden after normalization.
- Arity:
  - mv and cp require 2 paths; rm/rmdir/mkdirp require 1.
- Execution:
  - Pre‑ops run before applying unified diffs.
  - In --check (dry‑run), pre‑ops are validated and reported; no filesystem changes are made.

Examples

~~~~
### File Ops
mkdirp src/new/dir
mv src/old.txt src/new/dir/new.txt
cp src/new/dir/new.txt src/new/dir/copy.txt
rm src/tmp.bin
rmdir src/legacy/empty
~~~~

~~~~
### File Ops
mv packages/app-a/src/util.ts packages/app-b/src/util.ts
mkdirp packages/app-b/src/internal
rm docs/drafts/obsolete.md
~~~~
