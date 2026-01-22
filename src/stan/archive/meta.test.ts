import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../../test/helpers';
const { calls } = withMockTarCapture('TAR');

import { createMetaArchive } from './meta';

describe('createMetaArchive', () => {
  let dir: string;
  const stan = '.stan';

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-meta-'));
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('includes system/** (except .docs.meta.json) and context/dependency.meta.json only', async () => {
    // system files
    await mkdir(path.join(dir, stan, 'system'), { recursive: true });
    await writeFile(
      path.join(dir, stan, 'system', 'stan.system.md'),
      '# sys\n',
      'utf8',
    );
    await writeFile(
      path.join(dir, stan, 'system', '.docs.meta.json'),
      '{}\n',
      'utf8',
    );

    // dependency meta
    await mkdir(path.join(dir, stan, 'context'), { recursive: true });
    await writeFile(
      path.join(dir, stan, 'context', 'dependency.meta.json'),
      '{"schemaVersion":1,"nodes":{},"edges":{}}\n',
      'utf8',
    );

    // excluded-by-omission: dependency state and staged payloads
    await writeFile(
      path.join(dir, stan, 'context', 'dependency.state.json'),
      '{"include":[]}\n',
      'utf8',
    );
    await mkdir(path.join(dir, stan, 'context', 'npm', 'x', '1.0.0'), {
      recursive: true,
    });
    await writeFile(
      path.join(dir, stan, 'context', 'npm', 'x', '1.0.0', 'index.d.ts'),
      'export {};\n',
      'utf8',
    );

    const out = await createMetaArchive(dir, stan);
    expect(out.endsWith(path.join('output', 'archive.meta.tar'))).toBe(true);

    const call = calls.find((c) => c.file.endsWith('archive.meta.tar'));
    expect(call).toBeTruthy();
    const files = call?.files ?? [];

    // included
    expect(files).toEqual(
      expect.arrayContaining([
        `${stan}/system/stan.system.md`,
        `${stan}/context/dependency.meta.json`,
      ]),
    );

    // excluded
    expect(files).not.toEqual(
      expect.arrayContaining([
        `${stan}/system/.docs.meta.json`,
        `${stan}/context/dependency.state.json`,
        `${stan}/context/npm/x/1.0.0/index.d.ts`,
      ]),
    );
  });

  it('throws when dependency meta is missing', async () => {
    await mkdir(path.join(dir, stan, 'system'), { recursive: true });
    await expect(createMetaArchive(dir, stan)).rejects.toThrow(
      /dependency meta not found/i,
    );
  });
});
