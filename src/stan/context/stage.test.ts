import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import type { NodeSource } from './build';
import { stageDependencyContext } from './stage';

const sha256 = (buf: Buffer): string =>
  createHash('sha256').update(buf).digest('hex');

describe('stageDependencyContext', () => {
  it('stages npm + abs node bytes and verifies hash/size', async () => {
    const cwd = await makeTempDir('stan-stage-');
    const stanPath = '.stan';
    try {
      const npmNodeId = '.stan/context/npm/pkg/1.0.0/index.d.ts';
      const absNodeId =
        '.stan/context/abs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/x.d.ts';

      // Source files live outside the staged destination paths
      const srcDir = path.join(cwd, 'external');
      await mkdir(srcDir, { recursive: true });
      const npmSrcAbs = path.join(srcDir, 'npm.d.ts');
      const absSrcAbs = path.join(srcDir, 'abs.d.ts');

      const npmBody = Buffer.from('export type N = 1;\n', 'utf8');
      const absBody = Buffer.from('export type A = 2;\n', 'utf8');
      await writeFile(npmSrcAbs, npmBody);
      await writeFile(absSrcAbs, absBody);

      const meta = {
        nodes: {
          [npmNodeId]: {
            kind: 'external',
            metadata: { size: npmBody.length, hash: sha256(npmBody) },
          },
          [absNodeId]: {
            kind: 'external',
            metadata: { size: absBody.length, hash: sha256(absBody) },
            locatorAbs: absSrcAbs.replace(/\\/g, '/'),
          },
        },
      } as const;

      const sources: Record<string, NodeSource> = {
        [npmNodeId]: {
          kind: 'npm',
          sourceAbs: npmSrcAbs.replace(/\\/g, '/'),
          pkgName: 'pkg',
          pkgVersion: '1.0.0',
          pathInPackage: 'index.d.ts',
        },
        [absNodeId]: {
          kind: 'abs',
          sourceAbs: absSrcAbs.replace(/\\/g, '/'),
          locatorAbs: absSrcAbs.replace(/\\/g, '/'),
        },
      };

      const out = await stageDependencyContext({
        cwd,
        stanPath,
        meta,
        sources,
        clean: true,
      });

      expect(out.staged.map((s) => s.nodeId)).toEqual(
        expect.arrayContaining([npmNodeId, absNodeId]),
      );

      const npmStaged = await readFile(path.join(cwd, ...npmNodeId.split('/')));
      const absStaged = await readFile(path.join(cwd, ...absNodeId.split('/')));
      expect(npmStaged.toString('utf8')).toBe('export type N = 1;\n');
      expect(absStaged.toString('utf8')).toBe('export type A = 2;\n');
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('fails fast on hash mismatch', async () => {
    const cwd = await makeTempDir('stan-stage-mismatch-');
    const stanPath = '.stan';
    try {
      const nodeId = '.stan/context/npm/pkg/1.0.0/index.d.ts';
      const srcAbs = path.join(cwd, 'src.d.ts');
      const body = Buffer.from('export type X = 1;\n', 'utf8');
      await writeFile(srcAbs, body);

      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: { size: body.length, hash: 'deadbeef' },
          },
        },
      } as const;
      const sources: Record<string, NodeSource> = {
        [nodeId]: {
          kind: 'npm',
          sourceAbs: srcAbs.replace(/\\/g, '/'),
          pkgName: 'pkg',
          pkgVersion: '1.0.0',
          pathInPackage: 'index.d.ts',
        },
      };

      await expect(
        stageDependencyContext({ cwd, stanPath, meta, sources }),
      ).rejects.toThrow(/hash mismatch/i);
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('clean=true removes stale staged npm/abs dirs', async () => {
    const cwd = await makeTempDir('stan-stage-clean-');
    const stanPath = '.stan';
    try {
      await mkdir(path.join(cwd, '.stan', 'context', 'npm', 'stale'), {
        recursive: true,
      });
      await writeFile(
        path.join(cwd, '.stan', 'context', 'npm', 'stale', 'x.txt'),
        'stale\n',
        'utf8',
      );

      const srcAbs = path.join(cwd, 'src.d.ts');
      const body = Buffer.from('export type X = 1;\n', 'utf8');
      await writeFile(srcAbs, body);
      const nodeId = '.stan/context/npm/pkg/1.0.0/index.d.ts';

      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: { size: body.length, hash: sha256(body) },
          },
        },
      } as const;
      const sources: Record<string, NodeSource> = {
        [nodeId]: {
          kind: 'npm',
          sourceAbs: srcAbs.replace(/\\/g, '/'),
          pkgName: 'pkg',
          pkgVersion: '1.0.0',
          pathInPackage: 'index.d.ts',
        },
      };

      await stageDependencyContext({
        cwd,
        stanPath,
        meta,
        sources,
        clean: true,
      });

      // stale dir removed
      await expect(
        readFile(path.join(cwd, '.stan', 'context', 'npm', 'stale', 'x.txt')),
      ).rejects.toBeTruthy();
    } finally {
      await cleanupTempDir(cwd);
    }
  });
});
