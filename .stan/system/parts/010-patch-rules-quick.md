# Patch rules & canonical examples (quick)

Use plain unified diffs with git‑style headers. One Patch block per file.

Minimum requirements

- Use plain unified diffs with git-style headers (`diff --git`, `---`, `+++`).
- Emit exactly one Patch block per changed file.
- Put the commit message outside any diff fence (as the final section in normal replies).
- Use `/dev/null` headers for creates/deletes as shown below.

Canonical examples

Modify existing file:

~~~~diff
diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,4 +1,4 @@
-export const x = 1;
+export const x = 2;
 export function y() {
   return x;
 }
~~~~

New file:

~~~~diff
diff --git a/src/newfile.ts b/src/newfile.ts
--- /dev/null
+++ b/src/newfile.ts
@@ -0,0 +1,4 @@
+/** src/newfile.ts */
+export const created = true;
+export function fn() { return created; }
+
~~~~

Delete file:

~~~~diff
diff --git a/src/oldfile.ts b/src/oldfile.ts
--- a/src/oldfile.ts
+++ /dev/null
@@ -1,4 +0,0 @@
-export const old = true;
-export function gone() {
-  return old;
-}
~~~~

Pre‑send checks (quick)

- Every Patch block contains exactly one `diff --git a/<path> b/<path>`.
- Create/delete patches use `/dev/null` headers as shown above.
- For detailed policy and failure-mode handling, follow the canonical “Patch Coverage”, “Patch Policy”, and “Response Format” sections.