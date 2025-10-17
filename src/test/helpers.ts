// src/test/helpers.ts
import { rm } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { vi } from 'vitest';
import YAML from 'yaml';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Remove a directory with a short series of retries to mitigate transient
 * EBUSY/ENOTEMPTY on Windows test runners.
 *
 * @param dir - Absolute path to remove.
 * @param backoffMs - Backoff series in milliseconds (tunable).
 */
export const rmDirWithRetries = async (
  dir: string,
  // Extended default backoff to further absorb intermittent rmdir EBUSY on CI/Windows.
  // Total wait ~6.4s; callers can pass a shorter series when appropriate.
  backoffMs: number[] = [50, 100, 200, 400, 800, 1600, 3200],
): Promise<void> => {
  let lastErr: unknown;
  for (let i = 0; i <= backoffMs.length; i += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      lastErr = e;
      if (i === backoffMs.length) break;
      await delay(backoffMs[i]);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};

/**
 * Write a namespaced YAML config with a stan-core block.
 * Example:
 *   await writeStanConfigYaml(cwd, \{ stanPath: '.stan', includes: [], excludes: [] \});
 */
export const writeStanConfigYaml = async (
  cwd: string,
  core: Partial<{
    stanPath: string;
    includes: string[];
    excludes: string[];
    imports: Record<string, string[]>;
  }> = {},
  fileName = 'stan.config.yml',
): Promise<string> => {
  const body = YAML.stringify({
    'stan-core': {
      stanPath: core.stanPath ?? '.stan',
      includes: core.includes ?? [],
      excludes: core.excludes ?? [],
      ...(core.imports ? { imports: core.imports } : {}),
    },
  });
  const p = path.join(cwd, fileName);
  await writeFile(p, body, 'utf8');
  return p;
};

/**
 * Write a namespaced JSON config with a stan-core block.
 */
export const writeStanConfigJson = async (
  cwd: string,
  core: Partial<{
    stanPath: string;
    includes: string[];
    excludes: string[];
    imports: Record<string, string[]>;
  }> = {},
  fileName = 'stan.config.json',
): Promise<string> => {
  const body = JSON.stringify(
    {
      'stan-core': {
        stanPath: core.stanPath ?? '.stan',
        includes: core.includes ?? [],
        excludes: core.excludes ?? [],
        ...(core.imports ? { imports: core.imports } : {}),
      },
    },
    null,
    2,
  );
  const p = path.join(cwd, fileName);
  await writeFile(p, body, 'utf8');
  return p;
};

export type TarCall = {
  file: string;
  cwd?: string;
  filter?: (p: string, s: unknown) => boolean;
  files: string[];
};

/**
 * Install a tar.create mock and capture calls.
 * IMPORTANT: call at top-level before importing modules under test that import 'tar'.
 * Returns a capture object with `.calls` array; by default writes 'TAR' to the output file.
 */
export const withMockTarCapture = (writeBody = 'TAR'): { calls: TarCall[] } => {
  const calls: TarCall[] = [];
  vi.mock('tar', () => ({
    __esModule: true,
    default: undefined,
    create: async (
      opts: {
        file: string;
        cwd?: string;
        filter?: (p: string, s: unknown) => boolean;
      },
      files: string[],
    ) => {
      calls.push({
        file: opts.file,
        cwd: opts.cwd,
        filter: opts.filter,
        files,
      });
      await writeFile(opts.file, writeBody, 'utf8');
    },
  }));
  return { calls };
};
