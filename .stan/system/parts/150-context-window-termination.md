# Context window exhaustion (termination rule)

When context is tight or replies risk truncation:

1) Stop before partial output. Do not emit incomplete patches or listings.
2) Prefer scratch-based continuity:
   - If you can still safely emit patches, update `<stanPath>/system/stan.scratch.md` to reflect the current state and intended next step, then stop.
3) If you cannot safely emit patches (including scratch), stop cleanly:
   - Do not attempt to emit partial diffs or long listings.
   - Ask the user to start a new thread and paste the tail of the current discussion alongside the most recent archives.

This avoids half‑applied diffs and ensures integrity of the patch workflow.
