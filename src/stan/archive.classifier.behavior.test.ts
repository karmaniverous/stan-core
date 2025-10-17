import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../test/helpers';
import { createArchive } from './archive';
const { calls } = withMockTarCapture('TAR');
type TarCall = (typeof calls)[number];

describe('createArchive integrates classifier (excludes binaries, surfaces warnings via callback)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-arch-class-'));
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
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
