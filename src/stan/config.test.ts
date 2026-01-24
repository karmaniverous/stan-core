import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureOutputDir, loadConfig } from '@/stan/config';

import { writeStanConfigYaml } from '../test/helpers';
import { cleanupTempDir, makeTempDir } from '../test/tmp';

const write = (p: string, c: string) => writeFile(p, c, 'utf8');
describe('config loading (namespaced stan-core)', () => {
  it('loads valid JSON config and tolerates extraneous keys', async () => {
    const cwd = await makeTempDir('stan-json-');
    try {
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
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('loads valid YAML config (stan.config.yml)', async () => {
    const cwd = await makeTempDir('stan-yml-');
    try {
      await writeStanConfigYaml(cwd, { stanPath: 'stan', includes: [] });

      const cfg = await loadConfig(cwd);
      expect(cfg.stanPath).toBe('stan');
      expect(Array.isArray(cfg.includes)).toBe(true);
      expect(Array.isArray(cfg.excludes)).toBe(true);
    } finally {
      await cleanupTempDir(cwd);
    }
  });
});
