# Project‑Specific Augmentations — Multi‑Repo Coordination and Engine/CLI Boundaries

This document augments the system prompt with repo‑specific guidance for developing stan-core (engine) and stan-cli (CLI/runner) together using a published STAN baseline. It contains only instructions to the assistant. It is not a repository for project requirements or the dev plan.

The goals:

- Keep engine/CLI responsibilities clean: the CLI acquires/presents; the core decides/processes.
- Make multi‑repo context predictable and safe when archives ingest imports from other STAN instances.
- Provide a lightweight, deterministic interop channel for cross‑repo coordination (multi‑file, aggressively pruned).

---

## 1) Multi‑instance imports and disambiguation (authoritative vs contextual)

- You may see multiple files named “stan.requirements.md” and “stan.todo.md” in a single archive (local + imported copies from other STAN repos).
- Treat the local documents as the only authoritative targets for updates:
  - Local requirements: `<stanPath>/system/stan.requirements.md`
  - Local dev plan: `<stanPath>/system/stan.todo.md`
- Treat imported documents as read‑only context:
  - Imported content lives under: `.stan/imports/<label>/...`
  - Never create, patch, or delete files under `.stan/imports/**`. Do not propose edits to imported requirements/todo; use them only to inform decisions.
- When referencing a document, always disambiguate by explicit path. If you refer to an imported requirements/todo, include its `<label>` and the full repo‑relative path under `.stan/imports/<label>/...`.
- When proposing changes to requirements or the dev plan, target only the local files under `<stanPath>/system/`.

---

## 2) Interop threads — multi‑file messages (no front matter; aggressive pruning)

Use interop messages to coordinate cross‑repo actions (CLI ↔ Core). Messages are plain Markdown files; one file per message for small diffs and deterministic order.

- Locations
  - Outgoing (authored locally): `.stan/interop/<label>/*.md`
    - `<label>` is the operational slug the peer uses as its import label (e.g., “core-interop”, “cli-interop”).
  - Incoming (staged via imports): `.stan/imports/<label>/*.md`
    - These are read‑only; consume them before proposing cross‑repo work.

- Filename convention (ordering by name)
  - `<UTC>-<slug>.md`
    - `<UTC>`: `YYYYMMDD-HHMMSSZ` (UTC, so lexicographic sort = chronological order).
    - `<slug>`: short, url‑safe, lower‑case (e.g., `api-surface`, `clipboard-boundary`, `swappable-core`).

- Message body
  - Plain Markdown; optional initial heading; then short bullets explaining:
    - What/Why/Action items, and links/refs if helpful.
  - Keep each message atomic and self‑contained.

- Assistant obligations
  - Always scan incoming interop messages first (sorted lexicographically by filename) and incorporate them before proposing cross‑repo work.
  - When a change here implies a concrete action in the peer repo, propose creating a new outgoing interop message file under `.stan/interop/<label>/` using the filename convention and a concise body.
  - Append‑only behavior: never rewrite prior messages; post a new file for updates.
  - Aggressive pruning: as soon as an interop exchange is resolved and the conclusions are reflected in the local requirements/dev plan, propose File Ops to remove the now‑stale interop message file(s). Do not rotate; threads are intentionally short and ephemeral.

- File Ops examples (for pruning)
  - Propose:
    ```
    ### File Ops
    rm .stan/interop/<label>/20251001-170512Z-api-surface.md
    ```
  - Never propose File Ops that touch `.stan/imports/**`.

---

## 3) Imports bridge — linking peer docs/types/messages for context

- Ensure imports in `stan.config.*` stage high‑signal peer artifacts into this repo’s `.stan/imports/<label>/...` before archiving. Typical labels:
  - In stan-cli:
    - `core-docs`: `../stan-core/.stan/system/stan.requirements.md`, `../stan-core/.stan/system/stan.todo.md`
    - `core-types`: `../stan-core/dist/index.d.ts`
    - `core-interop`: `../stan-core/.stan/interop/stan-cli/*.md`
  - In stan-core:
    - `cli-docs`: `../stan-cli/.stan/system/stan.requirements.md`, `../stan-cli/.stan/system/stan.todo.md`
    - `cli-interop`: `../stan-cli/.stan/interop/stan-core/*.md`
- If the imports mapping is missing or incomplete and the change at hand benefits from those artifacts, propose a precise patch to `stan.config.*` that adds only the minimal patterns needed. Do not propose broad globs. Avoid adding imports solely for convenience if they create large or noisy archives.

---

## 4) Engine/CLI boundaries — acquisition vs processing (behavioral guardrails)

- CLI responsibilities (adapters; presentation):
  - Acquire inputs (arguments, files, clipboard) and pass data to the engine as plain strings and structured options.
  - Present outputs (warnings, statuses, diagnostics envelopes); open editors; handle TTY/live UI and cancellation.
  - When cross‑repo actions are needed, create/maintain outgoing interop messages under `.stan/interop/<label>/...` and aggressively prune resolved items.

- Core responsibilities (engine; processing):
  - Accept patch input as strings (engine does not acquire from clipboard).
  - Decide and process: selection/archiving/diffing/snapshot/patch pipeline/file ops/validation.
  - No console I/O from core; surface warnings/notes via return values or optional callbacks to the caller (CLI).
  - Provide prompt utilities (`getPackagedSystemPromptPath`, `assembleSystemMonolith`) as quiet, pure helpers; the CLI chooses if/how to invoke them.

- Assistant guardrails
  - Do not propose introducing clipboard/editor/TTY dependencies into the engine.
  - When proposing refactors or new behavior, keep the engine pure and push acquisition/presentation concerns into the CLI adapters.
  - If a change spans both repos, use interop messages to coordinate; do not attempt to drive both sides in a single monolithic patch unless requested.

---

## 6) Document cadence and commit behavior (unchanged)

- If you emit any code Patch blocks for this repo, you MUST also update the local dev plan under `<stanPath>/system/stan.todo.md` (unless the change set is deletions‑only or explicitly plan‑only) and end with a proper Commit Message block as defined in the system prompt.
- Never propose changes to imported documents (`.stan/imports/**`). Imported content is context only.

---

## 7) Code conventions — Zod schema and derived types

- Naming convention:
  - Zod schema identifiers MUST be lowerCamelCase with a Schema suffix:
    - Example: `abcXyzSchema` (e.g., `configSchema`, `userSettingsSchema`).
  - The derived TypeScript type MUST be PascalCase without a suffix:
    - Example: `AbcXyz` (e.g., `Config`, `UserSettings`).
- Pairing rule:
  - Always pair names consistently between schema and type:
    - <name>Schema (schema) ↔ <Name> (type).
  - Do not reuse the same identifier for both a schema and a type.
- Example:

```ts
import { z } from 'zod';

export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
```

---

## 8) Chat rendering vs tool ingestion (File Ops blocks)

- In assistant replies, a “### File Ops” block may be shown inside a fenced code block for readability in the chat client.
- That fence is a presentation wrapper only. When the developer copies the File Ops into tooling, they copy only the inner content (starting at the `### File Ops` line), not the fence markers.
- Therefore, do not treat the presence of fence markers in a chat transcript as evidence that the File Ops block itself is “fenced” at ingestion time.
- When reasoning about engine behavior, assume the tool receives the unfenced File Ops lines (verbs + repo-relative paths), not the chat wrapper.

---

## Linting policy (project-level)

- Enforce strict, type‑aware ESLint rules across all TypeScript files, including tests.
- Do not disable any linting rule without prior discussion and agreement.
- Prettier remains the sole source of truth for formatting; ESLint defers to Prettier for style.

## SSR/ESM test‑stability (engine patterns)

Under Vitest SSR, import‑time evaluation order can differ from Node runtime. To keep tests deterministic without changing runtime behavior:

- Hoist fragile exports
  - Prefer exported function declarations over `export const fn = (...) => ...` for helpers that other modules resolve dynamically.
- Resolve at call‑time where appropriate
  - Use `await import(...)` inside the action that needs the helper to avoid module‑eval races in tests.
  - Pick functions via a “named‑or‑default” resolver:
    - prefer `mod.named`, fall back to `mod.default.named`, and finally to `mod.default` when it is a callable function.
- Keep test‑only optionals defensive
  - Optional helpers should be behind `?.` in test paths to avoid throwing under SSR.
- Engine purity (no console I/O)
  - Surface warnings/notes via return values or optional callbacks (e.g., archive classifier warnings), not console output.
- Examples in this repo
  - Classifier resolution in archiving/diff paths uses a named‑or‑default, action‑time dynamic import to avoid SSR hazards.
  - Heavy, environment‑specific dependencies (e.g., `tar`) are resolved at call‑time.
