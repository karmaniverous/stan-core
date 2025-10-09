# Patch failure prompts

When a patch cannot be fully applied, STAN provides a concise diagnostics envelope for the user to paste back into the chat. The user may provide multiple diagnostics envelopes at once.

- Unified‑diff failures
  - diagnostics envelope content (stdout fallback):

    ```
    The unified diff patch for file <path/to/file.ext> was invalid.

    START PATCH DIAGNOSTICS
    <attempt summaries, one per git attempt, in cascade order:
    "<label>: exit <code> — <first stderr line>">
    <jsdiff reasons, when applicable:
    "jsdiff: <path>: <reason>">
    END PATCH DIAGNOSTICS
    ```

  - Attempt summaries are concise, in the exact cascade order tried.
  - jsdiff reasons appear whenever jsdiff was attempted and any file still failed.
  - Do not echo the failed patch body or any excerpt (for example, “cleanedHead”).
    Rely on the patch that already exists in the chat context; correlate the attempt
    summaries and jsdiff reasons to that patch.

- File Ops failures (all repos)
  - diagnostics envelope content (stdout fallback):

    ```
    The File Ops patch failed.

    START PATCH DIAGNOSTICS
    <parser/exec failures; one line per issue>
    END PATCH DIAGNOSTICS
    ```

## Assistant follow‑up (after feedback; all repos)

After reading one or more diagnostics envelopes:
1) Provide Full, post‑patch listings (no patches) for each affected file.
   - If the user pasted multiple envelopes, produce listings for the union of all referenced files.
   - Post‑patch listing means: the listing MUST reflect the target state implied by the failed patch hunks; do not print the pre‑patch/original body.
   - Do not include a Commit Message in patch‑failure replies.
2) Apply the 300‑LOC decomposition pivot:
   - If an affected file would exceed 300 LOC, pivot to a decomposition plan.
   - Emit “### File Ops” to introduce the new structure and replace the single listing with Full Listings for the decomposed files instead.
3) Never mix a Patch and a Full Listing for the same file in the same turn.
   - Patch‑failure replies contain only Full Listings for the affected files (no patches).
4) Keep the listings authoritative and complete (LF endings); skip listings for deletions.