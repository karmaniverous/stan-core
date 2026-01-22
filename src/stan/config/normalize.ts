/**
 * Normalization helpers for config parsing and CLI defaults; pure helpers (no
 * IO).
 * @module
 */

export const normalizeMaxUndos = (v: unknown): number => {
  const n =
    typeof v === 'number'
      ? Math.floor(v)
      : Number.isFinite(Number.parseInt(String(v), 10))
        ? Math.floor(Number.parseInt(String(v), 10))
        : NaN;
  if (!Number.isFinite(n) || n < 1) return 10;
  return n;
};

export const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length ? v : undefined;

export const asBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return undefined;
};

export const asStringArray = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === 'string' ? x : undefined))
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return out.length ? out : [];
};
