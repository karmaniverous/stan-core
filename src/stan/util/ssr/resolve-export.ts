/**
 * Resolves a module export using an SSR-friendly “named-or-default” strategy:
 * prefer `mod[name]`, then `mod.default?.[name]`, and optionally accept a
 * callable default export. Used to harden Vitest SSR dynamic import behavior.
 * @module
 */

export type ResolveExportOptions = {
  /**
   * Optional label used in error messages (e.g., `'./classifier'`).
   * Helps diagnose import/export drift in SSR/test environments.
   */
  moduleLabel?: string;
  /**
   * When true, allow resolving a callable `mod.default` as the export value
   * (useful when a module default-exports a function).
   */
  acceptCallableDefault?: boolean;
};

const asRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object') return null;
  return v as Record<string, unknown>;
};

const hasOwn = (o: object, k: string): boolean =>
  Object.prototype.hasOwnProperty.call(o, k);

/**
 * Runtime guard for functions.
 *
 * Note: this intentionally does not validate the full signature. It exists to
 * type-narrow dynamic imports in SSR-safe code paths.
 */
export const functionGuard = <T extends Function>(): ((
  v: unknown,
) => v is T) => {
  return (v: unknown): v is T => typeof v === 'function';
};

/**
 * Resolve an export from a dynamically imported module using a resilient
 * named-or-default strategy.
 *
 * @typeParam T - The expected export type.
 * @param importer - Function that imports/loads the module (usually `() => import('...')`).
 * @param exportName - The export name to resolve.
 * @param guard - Type guard that validates the resolved value.
 * @param options - Optional behavior and error-message label.
 * @returns The resolved export value.
 */
export const resolveExport = async <T>(
  importer: () => Promise<unknown>,
  exportName: string,
  guard: (v: unknown) => v is T,
  options: ResolveExportOptions = {},
): Promise<T> => {
  const label = options.moduleLabel ?? '(module)';

  let modUnknown: unknown;
  try {
    modUnknown = await importer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`failed to import ${label}: ${msg}`);
  }

  const modObj = asRecord(modUnknown);
  if (!modObj) {
    throw new Error(`invalid module shape for ${label}: expected an object`);
  }

  // 1) Prefer named export.
  if (hasOwn(modObj, exportName)) {
    const v = modObj[exportName];
    if (guard(v)) return v;
  }

  // 2) Fall back to default.<name> when default is an object.
  const defObj = asRecord(modObj.default);
  if (defObj && hasOwn(defObj, exportName)) {
    const v = defObj[exportName];
    if (guard(v)) return v;
  }

  // 3) Optional: accept callable default export itself.
  if (options.acceptCallableDefault) {
    const def = modObj.default;
    if (guard(def)) return def;
  }

  throw new Error(`export "${exportName}" not found in ${label}`);
};

export default { functionGuard, resolveExport };
