# Dependency context v2 — nodeId is archive address

We’ve locked the dependency-context v2 model end-to-end:

- `dependency.meta.json` is assistant-facing and must be thin.
- `nodeId` is the archive address (repo-relative POSIX path) where the file exists inside archives.
  - Repo-local: `src/index.ts`
  - External: staged `.stan/context/**` paths (no `node_modules/**`, no OS absolute paths in assistant-visible meta)
- OS source resolution is transient to `stan run -c` and must not be written into assistant-facing meta/state.
- Integrity enforcement is “good enough” as `size` (bytes) + 128-bit sha256 prefix (base64url, no padding).

Implications for stan-cli:

- Treat v2 meta/state formats as authoritative when present:
  - `.stan/context/dependency.meta.json` v2 (compact)
  - `.stan/context/dependency.state.json` v2 (`v:2`, `i`/`x`, kindMask bitmask)
- Ensure the v2 state file is included in `archive.meta.tar` so the assistant can read its prior directives.
- Ensure `stan run -c` rebuilds meta each run and uses compiler-resolved sources to stage bytes into `.stan/context/**` before archiving.

stan-core will implement v2 generation + parsing and will normalize external nodeIds into `.stan/context/**` staged paths.
