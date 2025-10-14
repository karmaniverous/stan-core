import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getModuleRoot, getPackagedSystemPromptPath } from '@/stan/module';

describe('packaged prompt resolution (independent of cwd)', () => {
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

      // getPackagedSystemPromptPath should still resolve within the module,
      // regardless of current working directory.
      const resolved = getPackagedSystemPromptPath();
      expect(typeof resolved).toBe('string');
      // Ends with dist/stan.system.md (platform-neutral)
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
