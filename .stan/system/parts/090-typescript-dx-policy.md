# TypeScript (DX + inference + schema-first)

- Code should be DRY and SOLID.
- Prefer a services-first architecture: core logic in services behind ports; adapters remain thin.
- Wrap prose in code comments (JSDoc/TSDoc) at 80 characters; place `@module`/`@packageDocumentation` tags after prose content within the same docblock.

Type inference (CRITICAL):

- Type casts are a code smell; ALWAYS prefer inference, discriminated unions, and type guards over casts.
- Public APIs MUST support type inference without requiring downstream consumers to pass explicit type parameters.
- Favor intuitive signatures and inferred types over verbose annotations; changes that degrade downstream inference require rework or a design adjustment before merging.
- Type-only imports MUST use `import type` (or inline `type` specifiers for mixed imports).

Avoid `any` (CRITICAL):

- The assistant MUST aggressively avoid the `any` type.
- Prefer `unknown` with explicit narrowing (type guards), or precise structural types such as `Record<string, unknown>`.
- If there is a compelling reason to use `any`, STOP and request a brief design discussion before implementing it.
- Once agreed, use the narrowest-scope `any` possible and memorialize the rationale with an inline comment at the point of use.

Schema-first architecture (when runtime schemas are used):

- Prefer a schema-first design: runtime schema is the source of truth; types are derived from schema; validation/parsing is centralized.
- Keep this guidance generic with respect to schema libraries (do not hard-code a specific schema tool into generic policies).

Schema naming convention:

- A schema value is a variable and MUST be lowerCamelCase and end in `Schema` (e.g., `myTypeSchema`).
- The inferred TypeScript type MUST be PascalCase and MUST NOT include `Schema` (e.g., `MyType`).
- Do not reuse the same identifier for both a schema and a type.

Exceptions:

- Exceptions are permitted only after a brief design discussion and rationale captured in the development plan.
