/**
 * Locates the module root and packaged prompt artifacts (dist/stan.system.md);
 * filesystem reads only; no side effects beyond resolution.
 * @module
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

/** Resolve the current module's root (realpath-hardened), or null. */
export const getModuleRoot = (): string | null => {
  try {
    const self = fileURLToPath(import.meta.url);
    const here = path.dirname(self);
    return packageDirectorySync({ cwd: here }) ?? null;
  } catch {
    return null;
  }
};

/** Resolve packaged dist/stan.system.md if present. */
export const getPackagedSystemPromptPath = (): string | null => {
  const root = getModuleRoot();
  if (!root) return null;
  const p = path.join(root, 'dist', 'stan.system.md');
  return existsSync(p) ? p : null;
};
