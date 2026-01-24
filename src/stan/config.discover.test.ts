import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findConfigPathSync, resolveStanPathSync } from '@/stan/config';

import { cleanupTempDir, makeTempDir } from '../test/tmp';

describe('config discovery and fallback stanPath', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-discover-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('returns null when no config exists and resolves default stanPath', async () => {
    const sub = path.join(dir, 'a', 'b');
    await mkdir(sub, { recursive: true });
    expect(findConfigPathSync(sub)).toBeNull();
    expect(resolveStanPathSync(sub)).toBe('.stan');
  });

  it('finds nearest stan.config.yml when ascending package roots', async () => {
    // Write a config at repo root (content shape unimportant for discovery)
    const yml = ['stan-core:', '  stanPath: stan', ''].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');
    // Ensure a package.json so packageDirectorySync can identify the repo root
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg' }),
      'utf8',
    );

    // Deep subfolder
    const deep = path.join(dir, 'packages', 'app1', 'src');
    await mkdir(deep, { recursive: true });
    const found = findConfigPathSync(deep);
    expect(
      found && found.replace(/\\/g, '/').endsWith('/stan.config.yml'),
    ).toBe(true);
  });
});
