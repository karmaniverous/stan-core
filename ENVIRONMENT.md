# Environment variables — stan‑core (engine)

This page enumerates environment variables recognized by the stan‑core library (runtime), as well as test/dev and release‑time variables used in this repository. The engine itself is presentation‑free; it only observes a minimal set of switches for debugging.

Notes
- Scope labels indicate where the variable is honored: runtime (library), tests/dev (local), or release (maintainers).
- Unless stated otherwise, variables are optional.

## Runtime (library)

### STAN_DEBUG
- Scope: runtime (library)
- Values:
  - `1` — enable debug output during patch application (git apply attempts).
  - any other value or unset — disabled (default).
- Effect:
  - When `applyPatchPipeline` falls through to the git path, stan‑core calls an internal helper (`runGitApply`). If `STAN_DEBUG=1`, the child process streams (stdout/stderr) for each `git apply` attempt are forwarded to the current process streams as they occur.
  - On failed attempts, concise failure lines are printed (e.g., “stan: git apply failed for … (exit N)”).
  - No other library surfaces emit console I/O; this flag is intended strictly for local diagnostics while developing or investigating patch application issues.
- Example:
```bash
STAN_DEBUG=1 node ./scripts/apply.js
```

## Tests / Development (repository)

These variables are used by the repository’s test harness or local tooling and are not read by the published library in normal use.

### STAN_TEST_REAL_TAR
- Scope: tests/dev (local only)
- Values:
  - `1` — opt out of the test‑time tar module mock.
  - unset or other — keep the default tar mock.
- Effect:
  - The test bootstrap (`src/test/mock-tar.ts`) globally mocks the `tar` module to avoid creating real archives in unit tests. Setting `STAN_TEST_REAL_TAR=1` disables this mock for ad‑hoc local runs that intentionally exercise real archiving.
- Example:
```bash
STAN_TEST_REAL_TAR=1 vitest run
```

## Release / Maintainers

These variables are used by project maintenance scripts in this repository and are not consumed by the library at runtime.

### GITHUB_TOKEN
- Scope: release (maintainers)
- Values:
  - A GitHub Personal Access Token with permissions sufficient for creating releases (used by release‑it).
- Effect:
  - The `npm run release` script uses `dotenvx` to load `.env.local` and pass `GITHUB_TOKEN` to release tooling. This is for maintainers publishing new versions; end‑users of the library do not need it.
- Setup:
  - Copy `.env.local.template` to `.env.local` and set `GITHUB_TOKEN=<your-token>`.

## CLI‑only variables (reference)

The following switches are used by stan‑cli (the separate CLI/runner) and are listed here for awareness. They are NOT consumed by the stan‑core library:
- `STAN_BORING`, `NO_COLOR`, `FORCE_COLOR` — affect CLI presentation (unstyled tokens / color control).
- Other CLI‑specific toggles are documented in the stan‑cli repository.

## Summary

- stan‑core’s only runtime switch is `STAN_DEBUG` for patch pipeline diagnostics.
- Test and release variables (`STAN_TEST_REAL_TAR`, `GITHUB_TOKEN`) are repository‑local and not part of the public API surface.
- CLI‑presentation variables are out of scope for the engine; see stan‑cli.

