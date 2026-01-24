import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import { summarizeContextAllowlistBudget } from './budget';
import type { DependencyMetaFile } from './schema';

describe('summarizeContextAllowlistBudget', () => {
  it('uses meta.metadata.size when present and stats repo files otherwise', async () => {
    const cwd = await makeTempDir('stan-budget-');
    try {
      // Base repo file (stat fallback)
      const readmeRel = 'README.md';
      const readmeBody = '# readme\n';
      await writeFile(path.join(cwd, readmeRel), readmeBody, 'utf8');

      // Closure repo file (stat fallback)
      const srcRel = 'src/a.ts';
      const srcBody = 'export const a = 1;\n';
      await mkdir(path.join(cwd, 'src'), { recursive: true });
      await writeFile(path.join(cwd, srcRel), srcBody, 'utf8');

      // External staged node (meta size, file does not need to exist)
      const extRel = '.stan/context/npm/pkg/1.0.0/index.d.ts';
      const extBytes = 123;

      const meta: Pick<DependencyMetaFile, 'nodes'> = {
        nodes: {
          [extRel]: {
            kind: 'external',
            metadata: { size: extBytes, hash: 'h' },
          },
        },
      };

      const plan = {
        baseFiles: [readmeRel],
        selectedNodeIds: [srcRel, extRel],
        allowlistFiles: [readmeRel, srcRel, extRel],
      };

      const out = await summarizeContextAllowlistBudget({
        cwd,
        plan,
        meta,
        topN: 10,
      });

      expect(out.files).toBe(3);
      expect(out.totalBytes).toBe(
        Buffer.byteLength(readmeBody, 'utf8') +
          Buffer.byteLength(srcBody, 'utf8') +
          extBytes,
      );
      expect(out.estimatedTokens).toBe(out.totalBytes / 4);

      // Breakdown: baseOnly = README, closureOnly = src + ext, overlap = 0
      expect(out.breakdown.baseOnly.files).toBe(1);
      expect(out.breakdown.closureOnly.files).toBe(2);
      expect(out.breakdown.overlap.files).toBe(0);

      // Largest contains extRel first (123 > small files)
      expect(out.largest[0]?.path).toBe(extRel);
      expect(out.largest[0]?.bytes).toBe(extBytes);
      expect(out.largest[0]?.source).toBe('meta');

      // No warnings expected in this scenario
      expect(out.warnings).toEqual([]);
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('emits warnings when neither meta size nor stat is available', async () => {
    const cwd = await makeTempDir('stan-budget-missing-');
    try {
      const missing = 'nope.txt';
      const out = await summarizeContextAllowlistBudget({
        cwd,
        plan: {
          baseFiles: [],
          selectedNodeIds: [],
          allowlistFiles: [missing],
        },
        meta: { nodes: {} } as Pick<DependencyMetaFile, 'nodes'>,
      });
      expect(out.totalBytes).toBe(0);
      expect(out.warnings.some((w) => w.includes(missing))).toBe(true);
      expect(out.largest[0]?.source).toBe('missing');
    } finally {
      await cleanupTempDir(cwd);
    }
  });
});
