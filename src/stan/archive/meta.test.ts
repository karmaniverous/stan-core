import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../../test/helpers';
import { cleanupTempDir, makeTempDir } from '../../test/tmp';
const { calls } = withMockTarCapture('TAR');

import { createMetaArchive } from './meta';

describe('createMetaArchive', () => {
  let dir: string;
  const stan = '.stan';

  beforeEach(async () => {
    dir = await makeTempDir('stan-meta-');
    calls.length = 0;
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
    vi.restoreAllMocks();
  });

  it('includes system/** (except .docs.meta.json), dependency meta/state, and repo-root base files', async () => {
    // Repo-root base file
    await writeFile(path.join(dir, 'README.md'), '# readme\n', 'utf8');
    // Non-root file should not be included as a base file
    await mkdir(path.join(dir, 'src'), { recursive: true });
    await writeFile(
      path.join(dir, 'src', 'a.ts'),
      'export const a = 1;\n',
      'utf8',
    );

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

    // dependency state exists on disk but MUST be omitted from meta archive
    await writeFile(
      path.join(dir, stan, 'context', 'dependency.state.json'),
      '{"include":[]}\n',
      'utf8',
    );

    // excluded-by-omission: staged payloads
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
        'README.md',
      ]),
    );

    // excluded
    expect(files).not.toEqual(
      expect.arrayContaining([
        `${stan}/system/.docs.meta.json`,
        `${stan}/context/dependency.state.json`,
        `${stan}/context/npm/x/1.0.0/index.d.ts`,
        'src/a.ts',
      ]),
    );
  });

  it('includeOutputDir=true includes <stanPath>/output (combine) while tar filter excludes archive files', async () => {
    // Minimal required dependency meta
    await mkdir(path.join(dir, stan, 'context'), { recursive: true });
    await writeFile(
      path.join(dir, stan, 'context', 'dependency.meta.json'),
      '{"schemaVersion":1,"nodes":{},"edges":{}}\n',
      'utf8',
    );

    // system file (so the meta archive isn't empty besides dep meta)
    await mkdir(path.join(dir, stan, 'system'), { recursive: true });
    await writeFile(
      path.join(dir, stan, 'system', 'stan.system.md'),
      '# sys\n',
      'utf8',
    );

    // output tree (combine payload)
    await mkdir(path.join(dir, stan, 'output'), { recursive: true });
    await writeFile(path.join(dir, stan, 'output', 'lint.txt'), 'ok\n', 'utf8');
    await writeFile(
      path.join(dir, stan, 'output', 'archive.tar'),
      'old\n',
      'utf8',
    );

    await createMetaArchive(dir, stan, undefined, { includeOutputDir: true });

    const call = calls.find((c) => c.file.endsWith('archive.meta.tar'));
    expect(call).toBeTruthy();
    const files = call?.files ?? [];
    expect(files).toEqual(expect.arrayContaining([`${stan}/output`]));

    // Tar filter should still exclude archive files under output
    expect(typeof call?.filter).toBe('function');
    const f = call?.filter as (p: string, s: unknown) => boolean;
    expect(f(`${stan}/output/archive.tar`, undefined)).toBe(false);
  });

  it('throws when dependency meta is missing', async () => {
    await mkdir(path.join(dir, stan, 'system'), { recursive: true });
    await expect(createMetaArchive(dir, stan)).rejects.toThrow(
      /dependency meta not found/i,
    );
  });
});
