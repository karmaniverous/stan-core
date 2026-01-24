import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '@/stan/config';

import { cleanupTempDir, makeTempDir } from '../test/tmp';

const write = (p: string, s: string) => writeFile(p, s, 'utf8');

describe('config strict schema (stan-core only)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-config-strict-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('rejects unknown keys inside the stan-core block (YAML)', async () => {
    const yml = [
      'stan-core:',
      '  stanPath: stan',
      '  includes: []',
      '  extraKey: true',
    ].join('\n');
    const p = path.join(dir, 'stan.config.yml');
    await write(p, yml);
    await expect(loadConfig(dir)).rejects.toThrow(/extraKey/i);
  });

  it('missing-section error for JSON includes the file path (stan.config.json)', async () => {
    // Write a JSON config that omits "stan-core"
    const json = JSON.stringify({ 'stan-cli': { scripts: {} } }, null, 2);
    const p = path.join(dir, 'stan.config.json');
    await write(p, json);
    await expect(loadConfig(dir)).rejects.toThrow(/stan\.config\.json/);
    await expect(loadConfig(dir)).rejects.toThrow(
      /missing "stan-core" section/i,
    );
  });
});
