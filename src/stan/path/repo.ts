/* src/stan/path/repo.ts
 * Repo-relative path helpers (POSIX normalization and guards).
 */
import path from 'node:path';

/** Normalize to POSIX separators and strip leading ./ */
export const toPosix = (p: string): string =>
  p.replace(/\\/g, '/').replace(/^\.\/+/, '');

/** True when the path is absolute (POSIX or Windows root). */
export const isAbsolutePosix = (p: string): boolean => /^[/\\]/.test(p);

/**
 * Normalize a repo-relative path:
 * - trims input,
 * - converts to POSIX,
 * - strips trailing slashes,
 * - rejects absolute paths and any traversal ("..") segments.
 *
 * Returns null when invalid.
 */
export const normalizeRepoPath = (raw?: string): string | null => {
  if (!raw || !String(raw).trim()) return null;
  const posix = toPosix(String(raw).trim());
  if (isAbsolutePosix(posix)) return null;
  const parts = posix.split('/').filter(Boolean);
  if (parts.some((seg) => seg === '..')) return null;
  const norm = parts.join('/');
  return norm.length ? norm : null;
};

/** Ensure a repo-relative path resolves within cwd (guard against escape). */
export const resolveWithin = (
  cwd: string,
  rel: string,
): { abs: string; ok: boolean } => {
  const abs = path.resolve(cwd, rel);
  const root = path.resolve(cwd) + path.sep;
  const ok = abs === path.resolve(cwd) || abs.startsWith(root);
  return { abs, ok };
};
