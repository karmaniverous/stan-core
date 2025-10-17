import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getModuleRoot, getPackagedSystemPromptPath } from '@/stan/module';

describe('module root and packaged prompt resolution', () => {
  it('getPackagedSystemPromptPath returns null when missing and resolves when present', async () => {
    const root = getModuleRoot();
    // In very unusual environments this can be null; bail safely.
    expect(root && typeof root === 'string').toBe(true);
    if (!root) return;

    const distDir = path.join(root, 'dist');
    const promptPath = path.join(distDir, 'stan.system.md');

    // Ensure clean start
    await rm(promptPath, { force: true }).catch(() => {});

    // Absent -> null
    const before = getPackagedSystemPromptPath();
    expect(before).toBeNull();

    // Present -> returns the path
    await mkdir(distDir, { recursive: true });
    await writeFile(promptPath, '# prompt\n', 'utf8');
    const after = getPackagedSystemPromptPath();
    expect(typeof after).toBe('string');
    expect(after && after.endsWith(path.join('dist', 'stan.system.md'))).toBe(
      true,
    );

    // Cleanup (leave dist/ itself to avoid racing other tasks)
    await rm(promptPath, { force: true }).catch(() => {});
  });

  it('returns dist/stan.system.md when present even if process.cwd() is elsewhere', async () => {
    const root = getModuleRoot();
    expect(root && typeof root === 'string').toBe(true);
    if (!root) return; // unusual environment; bail safely

    const distDir = path.join(root, 'dist');
    await mkdir(distDir, { recursive: true });
    const promptPath = path.join(distDir, 'stan.system.md');

    // Ensure a clean starting point
    await rm(promptPath, { force: true }).catch(() => {});

    // Materialize a packaged prompt
    await writeFile(promptPath, '# prompt\n', 'utf8');

    const prevCwd = process.cwd();
    const temp = await mkdtemp(path.join(os.tmpdir(), 'stan-cwd-'));
    try {
      // Change to a temp directory unrelated to the module root
      process.chdir(temp);

      // Resolution must not depend on process.cwd()
      const resolved = getPackagedSystemPromptPath();
      expect(typeof resolved).toBe('string');
      expect(
        resolved && resolved.endsWith(path.join('dist', 'stan.system.md')),
      ).toBe(true);
    } finally {
      // Restore cwd and clean up
      try {
        process.chdir(prevCwd);
      } catch {
        // ignore
      }
      await rm(temp, { recursive: true, force: true }).catch(() => {});
      await rm(promptPath, { force: true }).catch(() => {});
    }
  });
});
