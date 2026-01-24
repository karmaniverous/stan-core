import {} from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../../test/tmp';
vi.mock('../apply', () => ({
  __esModule: true,
  buildApplyAttempts: () => [],
  runGitApply: () => {
    throw new Error('runGitApply should not be called for imports guard');
  },
}));

vi.mock('../jsdiff', () => ({
  __esModule: true,
  applyWithJsDiff: () => {
    throw new Error('applyWithJsDiff should not be called for imports guard');
  },
}));

describe('applyPatchPipeline imports guard', () => {
  it('refuses to apply patch that targets <stanPath>/imports/** when stanPath is provided', async () => {
    const cwd = await makeTempDir('stan-pipeline-guard-');
    try {
      const rel = '.stan/imports/x/readme.md';
      const cleaned = [
        `diff --git a/${rel} b/${rel}`,
        `--- a/${rel}`,
        `+++ b/${rel}`,
        '@@ -1,1 +1,1 @@',
        '-old',
        '+new',
        '',
      ].join('\n');

      const { applyPatchPipeline } = await import('./pipeline');
      const out = await applyPatchPipeline({
        cwd,
        patchAbs: path.join(cwd, '.stan', 'patch', '.patch'),
        cleaned,
        check: false,
        stanPath: '.stan',
      });

      expect(out.ok).toBe(false);
      expect(out.result.ok).toBe(false);
      expect(out.js?.failed.some((f) => f.path === rel)).toBe(true);
      expect(out.js?.failed[0]?.reason ?? '').toMatch(/protected imports/i);
    } finally {
      await cleanupTempDir(cwd);
    }
  });
});
