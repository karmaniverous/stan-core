# Fence Hygiene (Quick How‑To)

Goal: prevent broken Markdown when emitting fenced blocks, especially diffs and Markdown listings that contain embedded backtick fences.

Default wrapper

- Use **tilde fences** for all fenced code blocks we emit (**File Ops**, Patch blocks, Full Listings, templates/examples, and Commit Message blocks).
- Start with a **default fence of `~~~~`** (4 tildes). Tilde fences are valid Markdown but rare in code/docs, so collisions are much less common than with backtick fences.

Algorithm (tilde-based)

1) Scan every block you will emit. Compute the maximum contiguous run of `~` characters that appears anywhere in that block’s content.
2) Choose the outer fence length as `N = max(4, maxInnerTildes + 1)`.
3) Emit the block wrapped in `~`×N.
4) Re‑scan after composing. If any block’s outer fence is `<= maxInnerTildes`, bump N and re‑emit.

Hard rule (applies everywhere)
- Do not rely on a fixed tilde count. Always compute, then re‑scan.
- This applies to **File Ops**, Patch blocks, Full Listings, the Dependency Bug Report template, patch-failure diagnostics envelopes, and any example that includes fenced blocks.