import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../test/helpers';
import { cleanupTempDir, makeTempDir } from '../test/tmp';
void withMockTarCapture('TAR');

import { createArchiveDiff } from './diff';

describe('createArchiveDiff snapshotFileName (mode-keyed baselines)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-snapkey-');
    await writeFile(path.join(dir, 'a.txt'), 'A\n', 'utf8');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
    vi.restoreAllMocks();
  });

  it('writes the snapshot to the caller-provided snapshotFileName (instead of the default)', async () => {
    const stanPath = 'out';
    const snapshotFileName = '.archive.snapshot.context.json';

    await createArchiveDiff({
      cwd: dir,
      stanPath,
      baseName: 'archive',
      updateSnapshot: 'replace',
      snapshotFileName,
      includeOutputDirInDiff: false,
    });

    const expected = path.join(dir, stanPath, 'diff', snapshotFileName);
    expect(existsSync(expected)).toBe(true);

    const raw = await readFile(expected, 'utf8');
    expect(() => {
      JSON.parse(raw);
    }).not.toThrow();

    const defaultSnap = path.join(
      dir,
      stanPath,
      'diff',
      '.archive.snapshot.json',
    );
    expect(existsSync(defaultSnap)).toBe(false);
  });

  it('throws for an invalid snapshotFileName that attempts traversal', async () => {
    const stanPath = 'out';
    await expect(
      createArchiveDiff({
        cwd: dir,
        stanPath,
        baseName: 'archive',
        updateSnapshot: 'replace',
        snapshotFileName: '../oops.json',
        includeOutputDirInDiff: false,
      }),
    ).rejects.toThrow(/invalid snapshotFileName/i);
  });
});
