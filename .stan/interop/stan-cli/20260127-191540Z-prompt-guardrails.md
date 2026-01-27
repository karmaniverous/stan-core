# Prompt guardrails follow-through (core-side)

## What changed

- Updated the packaged system prompt parts in `stan-core` to reflect patch-only ingestion:
  - Tools may only see user-copied patch payloads, not the whole assistant reply.
  - Do not assume any reply-level validator exists or can enforce cross-reply conditions.

- Added an explicit intake rule:
  - No web search for in-repo source code when archives are available (avoid version skew).
  - Web search remains allowed only for third-party dependency research or time-sensitive external facts.

## Why

- Prevents assistants from “fixing” issues against the wrong repo version by browsing external sources.
- Keeps enforcement aligned with the real patch workflow (human-gated, prompt-gated).
