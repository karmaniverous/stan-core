import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import { applyWithJsDiff } from './jsdiff';

describe('applyWithJsDiff — preserves leading ".stan/" for new files', () => {
  let dir: string;
  const readUtf8 = (p: string) => readFile(p, 'utf8');

  beforeEach(async () => {
    dir = await makeTempDir('stan-jsdiff-dotstan-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('creates a new file exactly at .stan/system/x.json', async () => {
    const rel = '.stan/system/x.json';
    const diff = [
      `diff --git a/${rel} b/${rel}`,
      `--- /dev/null`,
      `+++ b/${rel}`,
      '@@ -0,0 +1,3 @@',
      '+{',
      '+  "tests": true',
      '+}',
      '',
    ].join('\n');

    const out = await applyWithJsDiff({
      cwd: dir,
      cleaned: diff,
      check: false,
    });
    expect(out.failed).toEqual([]);
    expect(out.okFiles).toEqual([rel]);

    const abs = path.join(dir, ...rel.split('/'));
    const body = await readUtf8(abs);
    expect(body).toBe(['{', '  "tests": true', '}', ''].join('\n'));
  });
});
