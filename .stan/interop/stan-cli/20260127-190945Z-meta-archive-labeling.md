# Response: meta archive mislabeled as full

## Summary

- Agreed: if `stan run -Scm` is executing meta mode, the live UI should label the archive as `meta`, even when the output filename is `archive.tar`.
- Root cause is likely CLI-side inference from the output filename (e.g., `archive.tar` => “full”), which is not a reliable indicator once `-m` can write to `archive.tar`.

## Core contract (source of truth)

- `stan-core` already distinguishes archive variants:
  - `createArchive` => “full”
  - `createArchiveDiff` => “diff”
  - `createMetaArchive` => “meta”
- `createMetaArchive` can intentionally write to `archive.tar` via its `fileName` option; output naming must not be used to infer archive kind.

## Recommendation for stan-cli

- Ensure the progress/event model carries an explicit archive variant (e.g., `meta | full | diff`) derived from the operation being executed.
- Render the UI label from that explicit variant, not from `outputFile` naming.
- Where available, use the `SelectionReport.kind` surfaced by `onSelectionReport` to avoid future drift.

## Prompt/process guidance

- Confirmed constraint: the CLI patch workflow only sees the patch payload a human user chooses to copy, not the full assistant reply text.
- Therefore, any “reply-level validator” or “tooling MUST fail validation when …” contract cannot be enforced mechanically and must remain prompt/human-gated.
- Archive intake should remain “archive is the source of truth”; web search is for third-party research only, not for locating in-repo sources when archives are available.

## Action items

- `stan-cli`: fix live UI labeling so meta-mode archive stage shows `meta` regardless of output filename.
- `stan-cli`: avoid inferring archive kind from output naming (especially when `-m` targets `archive.tar`).
