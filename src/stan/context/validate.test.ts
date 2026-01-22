import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateDependencySelection } from './validate';

const sha256 = (s: string): string =>
  createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

describe('validateDependencySelection (strict undo/redo seam)', () => {
  it('npm: ok when package@version exists and file hash matches', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-val-npm-ok-'));
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

      const nodeId = `${stanPath}/context/npm/${pkgName}/${pkgVersion}/${fileRel}`;
      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: { hash: sha256(body), size: Buffer.byteLength(body) },
          },
        },
        edges: { [nodeId]: [] },
      } as const;
      const state = { include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        cwd,
        stanPath,
        meta: meta as unknown as Parameters<
          typeof validateDependencySelection
        >[0]['meta'],
        state,
      });
      expect(out.ok).toBe(true);
      expect(out.mismatches).toEqual([]);
      expect(out.checkedNodeIds).toEqual([nodeId]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('npm: reports version mismatch when name exists but version differs', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-val-npm-ver-'));
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
      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: { hash: 'x', size: 1 },
          },
        },
        edges: { [nodeId]: [] },
      } as const;
      const state = { include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        cwd,
        stanPath,
        meta: meta as unknown as Parameters<
          typeof validateDependencySelection
        >[0]['meta'],
        state,
      });
      expect(out.ok).toBe(false);
      expect(out.mismatches[0]?.kind).toBe('npm');
      expect(out.mismatches[0]?.reason).toBe('package-version-mismatch');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('abs: ok when locatorAbs file hash matches', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-val-abs-ok-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'stan-val-abs-out-'));
    const stanPath = '.stan';
    try {
      const body = 'export type A = 1;\n';
      const absFile = path.join(outside, 'a.d.ts');
      await writeFile(absFile, body, 'utf8');

      const nodeId = `${stanPath}/context/abs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/a.d.ts`;
      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: { hash: sha256(body), size: Buffer.byteLength(body) },
            locatorAbs: absFile.replace(/\\/g, '/'),
          },
        },
        edges: { [nodeId]: [] },
      } as const;
      const state = { include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        cwd,
        stanPath,
        meta: meta as unknown as Parameters<
          typeof validateDependencySelection
        >[0]['meta'],
        state,
      });
      expect(out.ok).toBe(true);
      expect(out.mismatches).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('abs: reports hash mismatch when locatorAbs differs', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-val-abs-bad-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'stan-val-abs-bad-out-'));
    const stanPath = '.stan';
    try {
      const absFile = path.join(outside, 'a.d.ts');
      await writeFile(absFile, 'changed\n', 'utf8');

      const nodeId = `${stanPath}/context/abs/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/a.d.ts`;
      const meta = {
        nodes: {
          [nodeId]: {
            kind: 'external',
            metadata: {
              hash: sha256('expected\n'),
              size: Buffer.byteLength('expected\n'),
            },
            locatorAbs: absFile.replace(/\\/g, '/'),
          },
        },
        edges: { [nodeId]: [] },
      } as const;
      const state = { include: [[nodeId, 0]], exclude: [] };

      const out = await validateDependencySelection({
        cwd,
        stanPath,
        meta: meta as unknown as Parameters<
          typeof validateDependencySelection
        >[0]['meta'],
        state,
      });
      expect(out.ok).toBe(false);
      expect(out.mismatches[0]?.kind).toBe('abs');
      expect(out.mismatches[0]?.reason).toBe('hash-mismatch');
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
