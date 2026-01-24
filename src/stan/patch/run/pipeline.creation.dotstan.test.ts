import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../../test/tmp';
// Force git path to "fail" and jsdiff to report invalid, so the creation
// fallback runs and writes the target file. This avoids any real git usage.
vi.mock('../apply', () => ({
  __esModule: true,
  buildApplyAttempts: () => [],
  runGitApply: () =>
    Promise.resolve({
      ok: false,
      tried: [],
      lastCode: 1,
      captures: [],
    }),
}));
vi.mock('../jsdiff', () => ({
  __esModule: true,
  applyWithJsDiff: () =>
    Promise.resolve({
      okFiles: [],
      failed: [{ path: '(patch)', reason: 'invalid unified diff' }],
      sandboxRoot: null,
    }),
}));

describe('creation fallback — preserves leading ".stan/" segment', () => {
  let dir: string;
  const readUtf8 = (p: string) => readFile(p, 'utf8');

  beforeEach(async () => {
    dir = await makeTempDir('stan-create-dot-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
    vi.restoreAllMocks();
  });

  it('writes new file exactly under ".stan/system/..." when fallback triggers', async () => {
    const rel = '.stan/system/facet.state.json';
    // Intentionally incomplete "diff" so jsdiff fails and the fallback engages.
    const cleaned = [
      `diff --git a/${rel} b/${rel}`,
      `--- /dev/null`,
      `+++ b/${rel}`,
      '', // no @@ hunk — fallback will still write a trailing newline
    ].join('\n');

    const { applyPatchPipeline } = await import('./pipeline');
    const out = await applyPatchPipeline({
      cwd: dir,
      patchAbs: path.join(dir, '.stan', 'patch', '.patch'),
      cleaned,
      check: false,
    });
    expect(out.ok).toBe(true);

    const abs = path.join(dir, ...rel.split('/'));
    const body = await readUtf8(abs);
    // Fallback writes at least a trailing newline (empty content OK here).
    expect(body.endsWith('\n')).toBe(true);
  });
});
