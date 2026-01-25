import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import { NODE_KIND } from './schema';
import { validateDependencySelection } from './validate';

const sha256 = (s: string): string =>
  createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

describe('validateDependencySelection (strict undo/redo seam)', () => {
  it('npm: ok when package@version exists and file hash matches', async () => {
    const cwd = await makeTempDir('stan-val-npm-ok-');
    const stanPath = '.stan';
    try {
      const pkgName = 'pkg';
      const pkgVersion = '1.0.0';
      const fileRel = 'index.d.ts';
      const body = 'export type X = 1;\n';

      const pkgRoot = path.join(cwd, 'node_modules', pkgName);
      await mkdir(pkgRoot, { recursive: true });
      await writeFile(
        path.join(pkgRoot, 'package.json'),
        JSON.stringify({ name: pkgName, version: pkgVersion }, null, 2),
        'utf8',
      );
      await writeFile(path.join(pkgRoot, fileRel), body, 'utf8');

      const size = Buffer.byteLength(body);
      const hash = sha256(body);
      const nodeId = `${stanPath}/context/npm/${pkgName}/${pkgVersion}/${fileRel}`;

      const meta = {
        v: 2 as const,
        n: {
          [nodeId]: { k: NODE_KIND.EXTERNAL, s: size },
        },
      };
      const map = {
        v: 1 as const,
        nodes: {
          [nodeId]: {
            id: nodeId,
            locatorAbs: path.join(pkgRoot, fileRel),
            size,
            sha256: hash,
          },
        },
      };
      const state = { v: 2, include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        stanPath,
        meta,
        map,
        state,
      });
      expect(out.ok).toBe(true);
      expect(out.mismatches).toEqual([]);
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('npm: reports file mismatch when locator points to wrong file', async () => {
    const cwd = await makeTempDir('stan-val-npm-ver-');
    const stanPath = '.stan';
    try {
      const pkgName = 'pkg';
      const pkgRoot = path.join(cwd, 'node_modules', pkgName);
      await mkdir(pkgRoot, { recursive: true });
      await writeFile(
        path.join(pkgRoot, 'package.json'),
        JSON.stringify({ name: pkgName, version: '9.9.9' }, null, 2),
        'utf8',
      );

      const nodeId = `${stanPath}/context/npm/${pkgName}/1.0.0/index.d.ts`;
      // Map points to a file that doesn't exist
      const map = {
        v: 1 as const,
        nodes: {
          [nodeId]: {
            id: nodeId,
            locatorAbs: path.join(pkgRoot, 'missing.d.ts'),
            size: 10,
            sha256: 'x',
          },
        },
      };
      const meta = {
        v: 2 as const,
        n: { [nodeId]: { k: NODE_KIND.EXTERNAL, s: 10 } },
      };
      const state = { v: 2, include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        stanPath,
        meta,
        map,
        state,
      });
      expect(out.ok).toBe(false);
      expect(out.mismatches[0]?.reason).toBe('file-missing');
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('abs: ok when locatorAbs file hash matches', async () => {
    const cwd = await makeTempDir('stan-val-abs-ok-');
    const outside = await makeTempDir('stan-val-abs-out-');
    const stanPath = '.stan';
    try {
      const body = 'export type A = 1;\n';
      const absFile = path.join(outside, 'a.d.ts');
      const size = Buffer.byteLength(body);
      const hash = sha256(body);
      await writeFile(absFile, body, 'utf8');

      const nodeId = `${stanPath}/context/abs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/a.d.ts`;
      const meta = {
        v: 2 as const,
        n: {
          [nodeId]: { k: NODE_KIND.EXTERNAL, s: size },
        },
      };
      const map = {
        v: 1 as const,
        nodes: {
          [nodeId]: { id: nodeId, locatorAbs: absFile, size, sha256: hash },
        },
      };
      const state = { v: 2, include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        stanPath,
        meta,
        map,
        state,
      });
      expect(out.ok).toBe(true);
      expect(out.mismatches).toEqual([]);
    } finally {
      await cleanupTempDir(cwd);
      await cleanupTempDir(outside);
    }
  });

  it('abs: reports hash mismatch when locatorAbs differs', async () => {
    const cwd = await makeTempDir('stan-val-abs-bad-');
    const outside = await makeTempDir('stan-val-abs-bad-out-');
    const stanPath = '.stan';
    try {
      const absFile = path.join(outside, 'a.d.ts');
      await writeFile(absFile, 'changed0\n', 'utf8');

      const nodeId = `${stanPath}/context/abs/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/a.d.ts`;
      const size = Buffer.byteLength('expected\n');
      const hash = sha256('expected\n');
      const meta = {
        v: 2 as const,
        n: {
          [nodeId]: { k: NODE_KIND.EXTERNAL, s: size },
        },
      };
      const map = {
        v: 1 as const,
        nodes: {
          [nodeId]: { id: nodeId, locatorAbs: absFile, size, sha256: hash },
        },
      };
      const state = { v: 2, include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        stanPath,
        meta,
        map,
        state,
      });
      expect(out.ok).toBe(false);
      expect(out.mismatches[0]?.reason).toBe('hash-mismatch');
    } finally {
      await cleanupTempDir(cwd);
      await cleanupTempDir(outside);
    }
  });
});
