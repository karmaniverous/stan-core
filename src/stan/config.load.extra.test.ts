import { writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, loadConfigSync, resolveStanPathSync } from '@/stan/config';

const write = (p: string, s: string) => writeFile(p, s, 'utf8');

describe('config.load (minimal shape + unknown-key tolerance)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-config-load-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('unknown keys are tolerated and minimal fields are normalized', async () => {
    const yml = [
      'stanPath: out',
      'scripts:',
      '  a: echo a',
      'cliDefaults:',
      '  run:',
      '    sequential: true',
    ].join('\n');
    await write(path.join(dir, 'stan.config.yml'), yml);

    const cfg = await loadConfig(dir);
    expect(cfg.stanPath).toBe('out');
    expect(cfg.includes).toEqual([]);
    expect(cfg.excludes).toEqual([]);
  });

  it('throws when stanPath is not a non-empty string', async () => {
    const bad = ['stanPath: 0', 'scripts: {}'].join('\n');
    await write(path.join(dir, 'stan.config.yml'), bad);
    await expect(loadConfig(dir)).rejects.toThrow(/stanPath.*non-empty/i);
  });

  it('loadConfigSync yields defaults for optional arrays when omitted', () => {
    const yml = ['stanPath: out'].join('\n');
    const p = path.join(dir, 'stan.config.yml');
    writeFileSync(p, yml, 'utf8');
    const cfg = loadConfigSync(dir);
    expect(cfg.includes).toEqual([]);
    expect(cfg.excludes).toEqual([]);
  });

  it('resolveStanPathSync falls back to default when no config exists', () => {
    const stan = resolveStanPathSync(dir);
    expect(stan).toBe('.stan');
  });
});
