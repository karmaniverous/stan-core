# Magic numbers & strings (constants policy)

Policy-bearing “magic” literals MUST be hoisted into named constants.

Scope

- This applies to numbers and strings that encode behavior or policy (thresholds, ratios, timeouts, sentinel names, default patterns, and other values that would otherwise be repeated or argued about).
- This applies across runtime code, tooling, and validators.

How to hoist

- Prefer feature-scoped constants modules (e.g., `context/constants.ts`, `archive/constants.ts`) over a global catch-all constants file.
- Name constants by intent, not by value (e.g., `CONTEXT_TARGET_FRACTION`, not `SIXTY_FIVE_PERCENT`).
- Keep the constant close to the feature it governs so future contributors can find and update it safely.

Allowed exceptions

- Do not hoist obvious local literals that are self-evident and non-policy-bearing (for example: `0`, `1`, simple loop increments, empty string used as a local default), unless doing so materially improves clarity.

Enforcement guidance

- If a magic literal appears in multiple places or is referenced by documentation/prompt guidance, it is almost always a candidate for hoisting.
- When introducing a new policy constant, update the relevant docs/prompt guidance in the same change set so the value and the intent cannot drift.
