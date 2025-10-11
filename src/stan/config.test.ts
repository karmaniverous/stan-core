import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureOutputDir, loadConfig } from '@/stan/config';

const write = (p: string, c: string) => writeFile(p, c, 'utf8');
describe('config loading (namespaced stan-core)', () => {
  it('loads valid JSON config and tolerates extraneous keys', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-json-'));
    const json = JSON.stringify(
      {
        'stan-core': {
          stanPath: 'stan',
          excludes: ['README.md'],
        },
        // foreign sections are ignored by the engine
        'stan-cli': { scripts: { test: 'npm run test' } },
      },
      null,
      2,
    );
    await write(path.join(cwd, 'stan.config.json'), json);

    const cfg = await loadConfig(cwd);
    expect(cfg.stanPath).toBe('stan');
    expect(Array.isArray(cfg.includes)).toBe(true);
    expect(cfg.excludes).toEqual(['README.md']);

    const out = await ensureOutputDir(cwd, cfg.stanPath);
    await mkdir(out, { recursive: true }); // idempotent
  });

  it('loads valid YAML config (stan.config.yml)', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-yml-'));
    const yml = ['stan-core:', '  stanPath: stan', '  includes: []'].join('\n');
    await write(path.join(cwd, 'stan.config.yml'), yml);

    const cfg = await loadConfig(cwd);
    expect(cfg.stanPath).toBe('stan');
    expect(Array.isArray(cfg.includes)).toBe(true);
    expect(Array.isArray(cfg.excludes)).toBe(true);
  });
});
