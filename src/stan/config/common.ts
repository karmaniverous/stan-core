/**
 * Shared helpers for config parsing (YAML/JSON + Zod error formatting); pure
 * helpers (no filesystem IO).
 * @module
 */
import YAML from 'yaml';
import { ZodError } from 'zod';

/** Normalize imports: string -\> [string]; arrays trimmed; invalid -\> undefined. */
export const normalizeImports = (
  v: unknown,
): Record<string, string[]> | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(o)) {
    const raw = o[k];
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) out[k] = [s];
    } else if (Array.isArray(raw)) {
      const arr = raw
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((s) => s.length > 0);
      if (arr.length) out[k] = arr;
    }
  }
  return Object.keys(out).length ? out : undefined;
};

export const parseRoot = (
  rawText: string,
  isJson: boolean,
): Record<string, unknown> => {
  const rootUnknown: unknown = isJson
    ? (JSON.parse(rawText) as unknown)
    : (YAML.parse(rawText) as unknown);
  return rootUnknown && typeof rootUnknown === 'object'
    ? (rootUnknown as Record<string, unknown>)
    : {};
};

export const formatZodError = (e: unknown): string => {
  if (!(e instanceof ZodError)) return String(e);
  return e.issues
    .map((i) => {
      const path = i.path.join('.') || '(root)';
      let msg = i.message;
      if (path === 'stanPath' && /Expected string/i.test(msg)) {
        msg = 'stanPath must be a non-empty string';
      }
      return `${path}: ${msg}`;
    })
    .join('\n');
};
