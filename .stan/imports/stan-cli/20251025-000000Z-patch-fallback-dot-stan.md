# Patch creation fallback: leading dot dropped in “.stan/…” paths

## Summary
- When applying unified‑diff creation patches that add files under “.stan/…”, the created files sometimes appear under “stan/…” (dot removed). This suggests the creation fallback path normalization strips a leading “.” for non “./” paths.

## Minimal reproduction
```diff
diff --git a/.stan/system/facet.state.json b/.stan/system/facet.state.json
--- /dev/null
+++ b/.stan/system/facet.state.json
@@ -0,0 +1,3 @@
+{
+  "tests": true
+}
```
Observed result (fallback path): `stan/system/facet.state.json` created instead of `.stan/system/facet.state.json`.

## Hypothesis
- In the creation fallback (new‑file case), the relative target path `.stan/system/...` is being sanitized in a way that collapses a leading segment starting with a dot (intended for “./”), or a normalization step is treating `.stan` similar to “.”.

## Proposed fix
1) Treat “.stan/…” as a normal relpath — do not special‑case or strip its leading dot. Avoid transformations intended for “./”.
2) Prefer POSIX normalization for diff paths; do not re‑resolve through path.parse/format flows that can drop the initial “.” segment.
3) Guardrail: unit test the creation fallback with “.stan/system/x.json” and a sibling case “stan/system/x.json” to ensure both are respected.

## Acceptance criteria
- Applying the reproduction patch creates `.stan/system/facet.state.json` exactly.
- No regressions for creation patches elsewhere; CRLF/LF preservation unchanged.

## Notes
- Regular git‑apply creation typically works; this manifests when the pipeline falls back to the creation path.
- The CLI will keep emitting “.stan/…” targets as repo‑relative POSIX paths.
