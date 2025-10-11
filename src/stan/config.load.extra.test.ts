import { writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, loadConfigSync, resolveStanPathSync } from '@/stan/config';

const write = (p: string, s: string) => writeFile(p, s, 'utf8');

describe('config.load (namespaced stan-core + minimal shape)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-config-load-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads stan-core block and normalizes minimal fields', async () => {
    const yml = [
      'stan-core:',
      '  stanPath: out',
      '  excludes:',
      '    - CHANGELOG.md',
    ].join('\n');
    await write(path.join(dir, 'stan.config.yml'), yml);

    const cfg = await loadConfig(dir);
    expect(cfg.stanPath).toBe('out');
    expect(cfg.includes).toEqual([]);
    expect(cfg.excludes).toEqual(['CHANGELOG.md']);
  });

  it('throws when stanPath is not a non-empty string', async () => {
    const bad = ['stan-core:', '  stanPath: 0'].join('\n');
    await write(path.join(dir, 'stan.config.yml'), bad);
    await expect(loadConfig(dir)).rejects.toThrow(/stanPath.*non-empty/i);
  });

  it('loadConfigSync yields defaults for optional arrays when omitted', () => {
    const yml = ['stan-core:', '  stanPath: out'].join('\n');
    const p = path.join(dir, 'stan.config.yml');
    writeFileSync(p, yml, 'utf8');
    const cfg = loadConfigSync(dir);
    expect(cfg.includes).toEqual([]);
    expect(cfg.excludes).toEqual([]);
  });

  it('errors when stan-core section is missing', async () => {
    const yml = ['not-stan-core:', '  foo: 1'].join('\n');
    await write(path.join(dir, 'stan.config.yml'), yml);
    await expect(loadConfig(dir)).rejects.toThrow(
      /missing "stan-core" section/i,
    );
  });

  it('resolveStanPathSync falls back to default when no config exists', () => {
    const stan = resolveStanPathSync(dir);
    expect(stan).toBe('.stan');
  });
});
