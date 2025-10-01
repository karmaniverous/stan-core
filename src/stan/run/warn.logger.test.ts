import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextConfig } from '@/stan/config';
import { runSelected } from '@/stan/run';

// Keep tar lightweight (avoid real archiving)
vi.mock('tar', () => ({
  __esModule: true,
  default: undefined,
  create: async ({ file }: { file: string }) => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, 'TAR', 'utf8');
  },
}));

describe('warn status (logger UI)', () => {
  let dir: string;
  const envBackup = { ...process.env };
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'stan-warn-logger-'));
    process.env = { ...envBackup, STAN_BORING: '1' }; // stable tokens
  });
  afterEach(async () => {
    process.env = { ...envBackup };
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('prints [WARN] when warnPattern matches combined output for exit=0', async () => {
    const cfg: ContextConfig = {
      stanPath: 'out',
      scripts: {
        hello: {
          script: 'node -e "process.stdout.write(`Something WARN here`)"',
          warnPattern: '\\\\bWARN\\\\b',
        },
      },
    };
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });

    await runSelected(dir, cfg, ['hello'], 'concurrent', {
      live: false,
      archive: false,
    });

    spy.mockRestore();
    const joined = logs.join('\n');
    expect(joined).toMatch(/stan:\s+\[WARN\]\s+"hello"/i);
  });
});
