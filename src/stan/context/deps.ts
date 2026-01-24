/**
 * Loads optional context-mode dependency compiler (`@karmaniverous/stan-context`)
 * via dynamic import; no side effects beyond loading; no console output.
 *
 * Context-mode dependency loaders (dynamic import; SSR-friendly).
 *
 * Requirements:
 * - Only load \@karmaniverous/stan-context when context mode is invoked.
 * - Keep engine presentation-free; throw with clear errors and let callers surface them.
 * - TypeScript is provided by the host (e.g., stan-cli) and injected into stan-context.
 * @module
 */

export type StanContextModule = {
  generateDependencyGraph: (opts: unknown) => Promise<unknown>;
};

export const loadStanContext = async (): Promise<StanContextModule> => {
  // Cast to a minimal contract so stan-core does not require stan-context types at build time.
  // Runtime availability is validated by import success.
  return (await import('@karmaniverous/stan-context')) as unknown as StanContextModule;
};

export default {
  loadStanContext,
};
