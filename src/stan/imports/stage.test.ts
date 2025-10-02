import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prepareImports } from './stage';

const read = (p: string) => readFile(p, 'utf8');

describe('prepareImports (staging under <stanPath>/imports)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-imports-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('stages files per label and preserves tail under glob-parent', async () => {
    const root = path.join(dir, 'ext');
    await mkdir(path.join(root, 'api', 'v1'), { recursive: true });
    const a = path.join(root, 'types.d.ts');
    const b = path.join(root, 'api', 'v1', 'openapi.json');
    await writeFile(a, 'declare type X = 1;\n', 'utf8');
    await writeFile(b, '{"openapi":"3.1.0"}\n', 'utf8');

    const seen: Array<{ label: string; files: string[] }> = [];
    await prepareImports({
      cwd: dir,
      stanPath: '.stan',
      map: {
        '@scope/pkg': ['ext/**/*.d.ts', 'ext/api/**/*.json'],
      },
      onStage: (label, files) => {
        seen.push({ label, files });
      },
    });

    const stagedA = path.join(
      dir,
      '.stan',
      'imports',
      '@scope/pkg',
      'types.d.ts',
    );
    const stagedB = path.join(
      dir,
      '.stan',
      'imports',
      '@scope/pkg',
      'v1',
      'openapi.json',
    );
    const tA = await read(stagedA);
    const tB = await read(stagedB);
    expect(tA.includes('declare type X')).toBe(true);
    expect(tB.includes('"openapi"')).toBe(true);
    // onStage callback surfaces staged files (engine does not log)
    expect(seen.length).toBe(1);
    expect(seen[0]?.label).toBe('@scope/pkg');
    expect(Array.isArray(seen[0]?.files)).toBe(true);
    expect((seen[0]?.files?.length ?? 0) >= 2).toBe(true);
  });
});
