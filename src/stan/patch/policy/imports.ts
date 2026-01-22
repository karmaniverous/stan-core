/**
 * Enforces imports read-only policy (<stanPath>/imports/**); pure path checks;
 * no filesystem IO; used by patch and File Ops guards.
 *
 * Imports protection policy:
 * - <stanPath>/imports/** is staged context and is read-only.
 * - The engine must refuse File Ops and unified-diff targets that touch it
 *   when the caller provides a stanPath.
 * @module
 */
import { toPosix } from '@/stan/path/repo';

const normalize = (p: string): string =>
  toPosix(p)
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');

const isUnder = (prefix: string, rel: string): boolean => {
  const a = normalize(prefix);
  const b = normalize(rel);
  return b === a || b.startsWith(`${a}/`);
};

export const isProtectedImportsPath = (
  stanPath: string,
  rel: string,
): boolean => isUnder(`${normalize(stanPath)}/imports`, rel);

export const listProtectedImportsViolations = (
  stanPath: string,
  rels: string[],
): string[] => {
  const out: string[] = [];
  for (const r of rels) {
    if (isProtectedImportsPath(stanPath, r)) out.push(normalize(r));
  }
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
};

export default {
  isProtectedImportsPath,
  listProtectedImportsViolations,
};
