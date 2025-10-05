# STAN Development Plan

When updated: 2025-10-02 (UTC)

This plan tracks near‑term and follow‑through work for the stan‑core engine only. CLI/runner tasks are managed in the stan‑cli repository.

---

## Next up (priority order)

- Patch engine fidelity
  - Maintain the canonical ingestion path: `detectAndCleanPatch(raw) → cleaned` → `applyPatchPipeline({ cleaned, patchAbs, check })`.
  - Implement creation‑patch fallback for confident new‑file diffs (post‑pipeline), including nested path creation; add unit tests (write/sandbox).

- Packaging & distribution
  - Ensure Rollup outputs ESM/CJS + `.d.ts` only (no CLI bundle).
  - Ship `dist/stan.system.md` alongside library artifacts.
  - Keep `tar` and `fs-extra` as runtime externals; preserve tree‑shaking.

---

## Completed (recent)

- Maintenance (knip/interop)
  - Temporarily ignored six knip‑flagged helpers in stan‑core.
  - Posted an interop note to stan‑cli requesting a yes/no on moving patch helpers (context/detect/headers) vs deleting no‑ops/redundant items.

- Test fix (config.load)
  - Normalized Zod error wording for a scripts type‑mismatch to the stable message “scripts must be an object” so the `config.load` extra test matches `/scripts.*object/i`.

- Typecheck cleanup
  - Fixed Zod v4 record overload usage by specifying key schema in `z.record(...)` for `ImportsSchema` and `ScriptsSchema`.
  - Tightened typing in config loader: cast validated `parsed.scripts` to `ScriptMap` to satisfy TS while preserving schema guarantees.
  - Resolves TS errors reported in typecheck output for `schema.ts` and `load.ts`.

- Top-level surface readiness
  - Exposed prompt helpers at the engine barrel: `getPackagedSystemPromptPath` and `assembleSystemMonolith` are now importable from the package top level.
  - Normalized package "types" to `dist/types/index.d.ts` to match generated Rollup d.ts outputs and the `exports` map. Ensures CLI consumers can import all surfaces via `@karmaniverous/stan-core` without subpaths.

- Console‑free surfaces (phase 1)
  - Archive: `createArchive` / `createArchiveDiff` now surface classifier warnings via optional `onArchiveWarnings(text)` callback; engine emits no console output. Tests updated to assert callbacks (no console spies).
  - Imports: `prepareImports` accepts optional `onStage(label, files[])` and no longer logs to console. Callback reports repo‑relative staged paths; tests updated to assert invocation.

- Engine surface hygiene
  - Removed presentation helpers from core:
    - Deleted `src/stan/util/{color.ts,status.ts,time.ts}` (engine is transport/presentation‑free).
  - Exported `CORE_VERSION` from the engine barrel; added a unit test that asserts presence and shape. This enables stan‑cli’s `--core` banner and compatibility checks without coupling.

- Interop coordination (exports confirmation)
  - Posted `.stan/interop/stan-cli/20251002-exports-confirmed.md` confirming top‑level exports for config, selection, archive/diff/snapshot, patch engine, imports staging, validation, prompt helpers, and `CORE_VERSION`. Package “types” normalized to `dist/types/index.d.ts`; CLI can import all surfaces via `@karmaniverous/stan-core` without subpaths.

- Posted interop guidance to stan‑cli identifying engine‑duplicate modules safe to delete and the corresponding `@karmaniverous/stan-core` imports to adopt.

- Removed `readPatchSource` from core and delegated patch source acquisition to stan‑cli.
  - Core remains string‑first: stan‑cli acquires raw text, calls `detectAndCleanPatch`, writes to `<stanPath>/patch/.patch`, then invokes `applyPatchPipeline`.

- Core/CLI decomposition (phase 1)
  - Removed CLI adapters/runner from the engine code base; pruned CLI‑only services/tests.
  - Rollup builds library and types only; CLI bundle removed.
  - Package metadata converged on engine‑only usage.
  - Archive warnings de‑colored; decoupled from CLI styling.
  - Patch barrel exports surfaced engine primitives.
  - Typedoc documents reflect engine‑only surfaces; CHANGELOG retained.
  - knip hints addressed; unused config entries pruned.

---

## Backlog / follow‑through

- Performance profiling for large repos (selection traversal and tar streaming).
- Optional logger injection pattern (future) to support host‑provided structured logging without introducing a logging dependency into core.

---

## Interop & imports hygiene (engine side)

- Outgoing interop (local authoring): `.stan/interop/stan-cli/<UTC>-<slug>.md`
  - Use for short, actionable coordination with stan‑cli on boundary or loader topics.
  - Aggressively prune resolved interop files via File Ops once conclusions are reflected here.

- Incoming interop (context only): `.stan/imports/stan-cli/*.md`
  - Scan staged peer notes before proposing cross‑repo actions.
  - Never modify or remove files under `.stan/imports/**`.

---

## Acceptance criteria (near‑term)

- No direct clipboard/editor/TTY dependencies; no console I/O in core.
- `createArchive` / `createArchiveDiff` and `prepareImports` surface notes via return values and/or callbacks; tests updated to assert data/callbacks.
- `CORE_VERSION` exported; prompt helpers (`getPackagedSystemPromptPath`, `assembleSystemMonolith`) available and quiet.
- Patch engine:
  - git apply attempt captures are structured and summarized,
  - jsdiff fallback tolerant to LF/CRLF and whitespace,
  - creation‑patch fallback works for confident new‑file cases and nested paths.
