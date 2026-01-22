/**
 * Renders concise diagnostics lines for patch failures; pure string helpers;
 * no IO; shared by formatters and adapters.
 * @module
 */

export type AttemptLabel = string;

/** Minimal shape for git-apply attempt captures we want to summarize. */
export type AttemptLike = {
  label: AttemptLabel;
  code: number;
  stderr?: string;
};

/**
 * Extract the first non-empty, trimmed line from stderr (if present).
 *
 * @param s - Raw stderr string (may be empty/undefined).
 * @returns First non-empty trimmed line, or undefined when none found.
 */
export const firstStderrLine = (s?: string): string | undefined => {
  if (!s) return undefined;
  const l = s.split(/\r?\n/).find((x) => x.trim().length > 0);
  return l?.trim();
};

/**
 * Render one summary line per git attempt in cascade order:
 *   "`<label>`: exit `<code>`[ — `first stderr line`]"
 *
 * @param captures - Attempt records in the original try order.
 * @returns Lines suitable for inclusion in a diagnostics envelope.
 */
export const renderAttemptSummary = (captures: AttemptLike[]): string[] => {
  return captures.map((a) => {
    const fl = firstStderrLine(a.stderr);
    return `${a.label}: exit ${String(a.code)}${fl ? ` — ${fl}` : ''}`;
  });
};
