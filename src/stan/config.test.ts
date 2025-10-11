import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureOutputDir, loadConfig } from '@/stan/config';

const write = (p: string, c: string) => writeFile(p, c, 'utf8');
describe('config loading (minimal engine fields + unknown-key tolerance)', () => {
  it('loads valid JSON config and tolerates extraneous keys', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-json-'));
    const json = JSON.stringify(
      {
        stanPath: 'stan',
        // unknown/CLI-facing keys are tolerated and ignored by the engine
        scripts: { test: 'npm run test' },
        cliDefaults: { run: { sequential: true } },
      },
      null,
      2,
    );
    await write(path.join(cwd, 'stan.config.json'), json);

    const cfg = await loadConfig(cwd);
    expect(cfg.stanPath).toBe('stan');
    expect(cfg.includes).toEqual([]);
    expect(cfg.excludes).toEqual([]);

    const out = await ensureOutputDir(cwd, cfg.stanPath);
    await mkdir(out, { recursive: true }); // idempotent
  });

  it('loads valid YAML config (stan.config.yml)', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-yml-'));
    const yml = [
      'stanPath: stan',
      '# unknown key tolerated',
      'scripts:',
      '  test: npm run test',
    ].join('\n');
    await write(path.join(cwd, 'stan.config.yml'), yml);

    const cfg = await loadConfig(cwd);
    expect(cfg.stanPath).toBe('stan');
    expect(Array.isArray(cfg.includes)).toBe(true);
    expect(Array.isArray(cfg.excludes)).toBe(true);
  });
});
