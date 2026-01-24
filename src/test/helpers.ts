/* src/test/helpers.ts */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { vi } from 'vitest';
import YAML from 'yaml';

export { rmDirWithRetries } from './fs';

/**
 * NOTE: `rmDirWithRetries` has moved to `src/test/fs.ts` (vitest-free) and is
 * re-exported here for back-compat with existing imports.
 */

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
 *
 * Uses vi.hoisted() so that the capture survives Vitest's mock hoisting.
 */
export const withMockTarCapture = (writeBody = 'TAR'): { calls: TarCall[] } => {
  // Use a hoisted state so the vi.mock factory (also hoisted) can access
  // stable references. Include a .body field to control the written content.
  const state = vi.hoisted(() => ({ calls: [] as TarCall[], body: 'TAR' }));
  // Allow callers to override the default body for this suite.
  state.body = writeBody;

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
      state.calls.push({
        file: opts.file,
        cwd: opts.cwd,
        filter: opts.filter,
        files,
      });
      // Write the configured body; cannot capture local variables due to
      // hoisting, so read from hoisted state instead.
      await writeFile(opts.file, state.body, 'utf8');
    },
  }));
  return state;
};
