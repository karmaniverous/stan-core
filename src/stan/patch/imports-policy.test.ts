import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFileOpsBlock } from './file-ops';
import { applyWithJsDiff } from './jsdiff';

describe('imports read-only policy (engine safety net)', () => {
  it('parseFileOpsBlock rejects ops under <stanPath>/imports when stanPath is provided', () => {
    const msg = ['### File Ops', 'rm .stan/imports/x.md', ''].join('\n');
    const plan = parseFileOpsBlock(msg, '.stan');
    expect(plan.ops.length).toBe(0);
    expect(plan.errors.some((e) => /protected imports area/i.test(e))).toBe(
      true,
    );
  });

  it('jsdiff refuses to modify files under <stanPath>/imports when stanPath is provided', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'stan-imports-guard-'));
    try {
      const rel = '.stan/imports/pkg/readme.md';
      const abs = path.join(dir, ...rel.split('/'));
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, 'old\n', 'utf8');

      const diff = [
        `diff --git a/${rel} b/${rel}`,
        `--- a/${rel}`,
        `+++ b/${rel}`,
        '@@ -1,1 +1,1 @@',
        '-old',
        '+new',
        '',
      ].join('\n');

      const out = await applyWithJsDiff({
        cwd: dir,
        cleaned: diff,
        check: false,
        stanPath: '.stan',
      });
      expect(out.okFiles).toEqual([]);
      expect(out.failed.length).toBe(1);
      expect(out.failed[0]?.path).toBe(rel);
      expect(out.failed[0]?.reason ?? '').toMatch(/protected imports/i);

      // File must remain unchanged
      const body = await readFile(abs, 'utf8');
      expect(body).toBe('old\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
