// Minimal shim for optional dependency @karmaniverous/stan-context.
// The engine loads this package dynamically only when context mode is invoked.
declare module '@karmaniverous/stan-context' {
  export const generateDependencyGraph: (opts: unknown) => Promise<unknown>;
}
