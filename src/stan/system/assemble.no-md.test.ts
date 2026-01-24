import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assembleSystemMonolith } from '@/stan/system/assemble';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';

describe('assembleSystemMonolith skips when parts contains no .md files', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-assemble-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('action is "skipped-no-md" and target path is stable', async () => {
    const parts = path.join(dir, '.stan', 'system', 'parts');
    await mkdir(parts, { recursive: true });
    // Populate with a non-markdown file to exercise the no-md branch
    await writeFile(path.join(parts, 'note.txt'), 'x', 'utf8');

    const res = await assembleSystemMonolith(dir, '.stan');
    expect(res.action).toBe('skipped-no-md');
    expect(
      res.target.endsWith(path.join('.stan', 'system', 'stan.system.md')),
    ).toBe(true);
  });
});
