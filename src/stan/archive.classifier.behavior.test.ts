import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../test/tmp';
import { createArchive } from './archive';
let calls: Array<{
  file: string;
  cwd?: string;
  filter?: (p: string, s: unknown) => boolean;
  files: string[];
}>;

describe('createArchive integrates classifier (excludes binaries, surfaces warnings via callback)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-arch-class-');
    // Initialize tar mock capture for this suite; reset calls each run.
    const { withMockTarCapture } = await import('../test/helpers');
    const state = withMockTarCapture('TAR');
    calls = state.calls;
    calls.length = 0;
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
    vi.restoreAllMocks();
  });

  it('non-combine: excludes binaries and reports archive warnings via onArchiveWarnings', async () => {
    const out = 'out';
    // Prepare a few files in repo root
    await writeFile(
      path.join(dir, 'binary.bin'),
      Buffer.from([0x00, 0x01, 0x02]),
    ); // binary-ish
    await writeFile(path.join(dir, 'small.txt'), 'hello\n', 'utf8');
    const big = Array.from({ length: 3100 }, () => 'x').join('\n') + '\n';
    await writeFile(path.join(dir, 'big.txt'), big, 'utf8');

    const seen: string[] = [];
    await createArchive(dir, out, {
      includeOutputDir: false,
      onArchiveWarnings: (t) => {
        seen.push(t);
      },
    });

    const regCall = calls.find((c) => c.file.endsWith('archive.tar'));
    expect(regCall).toBeTruthy();
    const files = regCall?.files ?? [];

    // binary excluded
    expect(files).not.toEqual(expect.arrayContaining(['binary.bin']));
    // text included
    expect(files).toEqual(expect.arrayContaining(['small.txt', 'big.txt']));
    // warnings surfaced via callback (engine does not log)
    const body = seen.join('\n');
    expect(body).toMatch(/Binary files excluded|Large text files/);
  });
});
