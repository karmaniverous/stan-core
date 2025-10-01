import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const snapSpy = vi.fn(async (_opts?: { stash?: boolean }) => Promise.resolve());
vi.mock('@/stan/snap/snap-run', () => ({
  __esModule: true,
  handleSnap: (opts?: { stash?: boolean }) => snapSpy(opts),
}));

import { registerSnap } from '@/cli/stan/snap';
describe('snap defaults (opts.cliDefaults.snap.stash) and -S override', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-snap-def-'));
    process.chdir(dir);
    snapSpy.mockReset();
  });
  afterEach(async () => {
    try {
      process.chdir(tmpdir());
    } catch {
      // ignore
    }
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('uses default stash=true when not specified on CLI', async () => {
    const yml = [
      'stanPath: out',
      'scripts: {}',
      'cliDefaults:',
      '  snap:',
      '    stash: true',
    ].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');

    const cli = new Command();
    registerSnap(cli);
    await cli.parseAsync(['node', 'stan', 'snap'], { from: 'user' });
    expect(snapSpy).toHaveBeenCalledWith({ stash: true });
  });

  it('overrides default with -S/--no-stash', async () => {
    const yml = [
      'stanPath: out',
      'scripts: {}',
      'cliDefaults:',
      '  snap:',
      '    stash: true',
    ].join('\n');
    await writeFile(path.join(dir, 'stan.config.yml'), yml, 'utf8');

    const cli = new Command();
    registerSnap(cli);
    await cli.parseAsync(['node', 'stan', 'snap', '-S'], { from: 'user' });
    expect(snapSpy).toHaveBeenCalledWith({ stash: false });
  });
});
