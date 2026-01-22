# TypeDoc/TSDoc policy (exported API)

- All exported functions, classes, interfaces, types, and enums MUST have TypeDoc/TSDoc comments.
- Every TypeDoc/TSDoc comment MUST include a summary description.
- Function and method comments MUST document all parameters and the return type.
- All generic type parameters in exported functions, classes, interfaces, and types MUST be documented.
- All properties of exported interfaces and interface-like object types MUST have TSDoc comments.
- CRITICAL: Do NOT convert `type` aliases to `interface` purely to support property comments; TypeDoc supports property comments on object types.
- Use proper formatting for code elements (use backticks for code references).
- Special characters in TypeDoc/TSDoc comments (for example, \<, \>, \{, \}) MUST be escaped with a backslash to avoid rendering issues.

Exceptions:

- Exceptions are permitted only after a brief design discussion and rationale captured in the development plan.
