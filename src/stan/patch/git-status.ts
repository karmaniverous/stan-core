/**
 * No-op staged overlap check (retained for API stability); no filesystem IO;
 * no console output; async signature preserved.
 *
 * Staged-overlap check (disabled).
 *
 * Rationale: warning adds noise without actionable value; users can
 * manage staging themselves. Retained as a no-op for API stability.
 * @module
 */

export const maybeWarnStaged = async (
  _cwd: string,
  _touchedRel: string[],
): Promise<void> => {
  // Intentionally no-op.
  // Keep async signature and satisfy lint require-await.
  await Promise.resolve();
  // Mark parameters as used to satisfy no-unused-vars without changing signature.
  try {
    void _cwd;
    void _touchedRel;
  } catch {
    // ignore
  }
};
