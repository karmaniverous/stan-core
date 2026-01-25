import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import { computeContextAllowlistPlan } from './allowlist';
import { EDGE_KIND, NODE_KIND } from './schema';

describe('computeContextAllowlistPlan ignores config excludes under <stanPath>/**', () => {
  let dir: string;
  const stanPath = '.stan';

  beforeEach(async () => {
    dir = await makeTempDir('stan-ctx-excl-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('does not exclude system/meta or staged external nodeIds under .stan/**', async () => {
    // Minimal system + dependency meta on disk (required by planner)
    await mkdir(path.join(dir, stanPath, 'system'), { recursive: true });
    await writeFile(
      path.join(dir, stanPath, 'system', 'stan.system.md'),
      '# sys\n',
      'utf8',
    );
    await mkdir(path.join(dir, stanPath, 'context'), { recursive: true });
    await writeFile(
      path.join(dir, stanPath, 'context', 'dependency.meta.json'),
      '{"schemaVersion":1,"nodes":{},"edges":{}}\n',
      'utf8',
    );

    const external = '.stan/context/npm/pkg/1.0.0/index.d.ts';
    const seed = 'seed.ts';

    const meta = {
      v: 2 as const,
      n: {
        [seed]: { k: NODE_KIND.SOURCE, e: [[external, EDGE_KIND.TYPE]] },
        [external]: { k: NODE_KIND.EXTERNAL },
      },
    };

    const state = { v: 2, i: [[seed, 1]], x: [] };

    const plan = await computeContextAllowlistPlan({
      cwd: dir,
      stanPath,
      meta,
      state,
      selection: {
        // Intentionally broad hard denials; must NOT apply under .stan/**
        excludes: ['**', '.stan/**'],
      },
    });

    expect(plan.allowlistFiles).toEqual(
      expect.arrayContaining([
        '.stan/system/stan.system.md',
        '.stan/context/dependency.meta.json',
        external,
      ]),
    );
    // The repo-local seed is outside .stan/** and should be excluded by '**'
    expect(plan.allowlistFiles).not.toEqual(expect.arrayContaining([seed]));
    // The staged external is under .stan/** and must remain selected/stageable
    expect(plan.stageNodeIds).toEqual([external]);
  });
});
