/**
 * Loads optional context-mode dependencies (TypeScript + stan-context) via
 * dynamic import; no side effects beyond loading; no console output.
 *
 * Context-mode dependency loaders (dynamic import; SSR-friendly).
 *
 * Requirements:
 * - Only load TypeScript and @karmaniverous/stan-context when context mode is invoked.
 * - Keep engine presentation-free; throw with clear errors and let callers surface them.
 * @module
 */

export const loadTypeScript = async (): Promise<unknown> => {
  return import('typescript');
};

export type StanContextModule = {
  generateDependencyGraph: (opts: unknown) => Promise<unknown>;
};

export const loadStanContext = async (): Promise<StanContextModule> => {
  // Cast to a minimal contract so stan-core does not require stan-context types at build time.
  // Runtime availability is validated by import success.
  return (await import('@karmaniverous/stan-context')) as unknown as StanContextModule;
};

export default {
  loadTypeScript,
  loadStanContext,
};
