import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { filterFiles, listFiles } from './fs';

describe('anchors channel — re-include over excludes/.gitignore; blocked by reserved/output', () => {
  let dir: string;
  const stan = 'stan';
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-fs-anchors-'));
    // content
    await writeFile(path.join(dir, 'README.md'), '# readme\n', 'utf8');
    // reserved paths
    await mkdir(path.join(dir, stan, 'diff'), { recursive: true });
    await writeFile(path.join(dir, stan, 'diff', 'snap.json'), '{}\n', 'utf8');
    await mkdir(path.join(dir, stan, 'output'), { recursive: true });
    await writeFile(path.join(dir, stan, 'output', 'log.txt'), 'x\n', 'utf8');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('re-includes anchored path even when excluded by excludes and .gitignore', async () => {
    // Simulate a .gitignore that ignores README.md
    await writeFile(path.join(dir, '.gitignore'), 'README.md\n', 'utf8');
    const all = await listFiles(dir);
    // Exclude README.md explicitly; anchor it to force inclusion
    const out = await filterFiles(all, {
      cwd: dir,
      stanPath: stan,
      includeOutputDir: false,
      includes: [],
      excludes: ['README.md'],
      anchors: ['README.md'],
    });
    expect(out).toEqual(expect.arrayContaining(['README.md']));
  });

  it('does not include anchors under reserved paths (diff/patch) and respects output exclusion when includeOutputDir=false', async () => {
    const all = await listFiles(dir);
    const out = await filterFiles(all, {
      cwd: dir,
      stanPath: stan,
      includeOutputDir: false,
      anchors: [`${stan}/diff/snap.json`, `${stan}/output/log.txt`],
    });
    // Both are blocked: reserved diff; output excluded when includeOutputDir=false
    expect(out).not.toEqual(expect.arrayContaining([`${stan}/diff/snap.json`]));
    expect(out).not.toEqual(expect.arrayContaining([`${stan}/output/log.txt`]));
  });
});
