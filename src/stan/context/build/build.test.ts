import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../../test/tmp';
// Stub dynamic deps module so we can validate pass-through options deterministically.
let graphFactory: (() => unknown) | null = null;
let lastOpts: unknown = null;

vi.mock('../deps', () => ({
  __esModule: true,
  loadStanContext: () => {
    return Promise.resolve({
      generateDependencyGraph: (opts: unknown) => {
        lastOpts = opts;
        const o =
          opts && typeof opts === 'object'
            ? (opts as Record<string, unknown>)
            : {};
        // Mimic stan-context behavior: reject when TS injection is missing.
        if (
          !Object.prototype.hasOwnProperty.call(o, 'typescript') &&
          !Object.prototype.hasOwnProperty.call(o, 'typescriptPath')
        ) {
          throw new Error('stan-context: missing TypeScript injection');
        }
        return Promise.resolve(graphFactory ? graphFactory() : { graph: {} });
      },
    });
  },
}));

import { buildDependencyMeta } from './index';

describe('buildDependencyMeta (context mode: deps + normalization)', () => {
  it('passes host-injected typescript and typescriptPath through to stan-context', async () => {
    graphFactory = () => ({ graph: { nodes: {}, edges: {} } });

    await expect(
      buildDependencyMeta({
        cwd: process.cwd(),
        stanPath: '.stan',
        typescript: { injected: true },
        typescriptPath: '/abs/typescript/lib/typescript.js',
      }),
    ).resolves.toBeTruthy();

    const o =
      lastOpts && typeof lastOpts === 'object'
        ? (lastOpts as Record<string, unknown>)
        : {};
    expect(o.typescript).toEqual({ injected: true });
    expect(o.typescriptPath).toBe('/abs/typescript/lib/typescript.js');
  });

  it('does not gate TypeScript itself; errors come from stan-context when injection missing', async () => {
    graphFactory = () => ({ graph: { nodes: {}, edges: {} } });
    await expect(
      buildDependencyMeta({ cwd: process.cwd(), stanPath: '.stan' }),
    ).rejects.toThrow(/missing TypeScript injection/i);
  });

  it('omits builtin/missing nodes and normalizes npm + abs externals', async () => {
    const cwd = await makeTempDir('stan-meta-build-');
    const stanPath = '.stan';

    const write = (p: string, c: string) => writeFile(p, c, 'utf8');
    const json = (o: unknown) => JSON.stringify(o, null, 2);

    // Create a fake package under node_modules/pkg
    const pkgRoot = path.join(cwd, 'node_modules', 'pkg');
    await mkdir(pkgRoot, { recursive: true });
    await write(
      path.join(pkgRoot, 'package.json'),
      json({ name: 'pkg', version: '1.0.0' }),
    );
    const pkgFileAbs = path.join(pkgRoot, 'index.d.ts');
    await write(pkgFileAbs, 'export {};\n');

    // Create an abs file outside repo root
    const outside = await makeTempDir('stan-abs-');
    const absFileAbs = path.join(outside, 'x.d.ts');
    await write(absFileAbs, 'export type X = 1;\n');

    const srcId = 'src/a.ts';
    const npmOld = pkgFileAbs; // absolute
    const absOld = absFileAbs; // absolute
    const builtinOld = 'node:fs';
    const missingOld = './nope';

    graphFactory = () => ({
      graph: {
        nodes: {
          [srcId]: {
            kind: 'source',
            metadata: { size: 1, hash: 'h-src' },
            description: 'A',
          },
          [npmOld]: { kind: 'external', metadata: { size: 2, hash: 'h-npm' } },
          [absOld]: { kind: 'external', metadata: { size: 3, hash: 'h-abs' } },
          [builtinOld]: { kind: 'builtin' },
          [missingOld]: { kind: 'missing' },
        },
        edges: {
          [srcId]: [
            { target: npmOld, kind: 'type' },
            { target: builtinOld, kind: 'runtime' }, // should be dropped
          ],
          [npmOld]: [{ target: absOld, kind: 'type' }],
          [absOld]: [{ target: missingOld, kind: 'runtime' }], // should be dropped
          [builtinOld]: [],
          [missingOld]: [],
        },
      },
      stats: { modules: 5, edges: 3, dirty: 5 },
      errors: [],
    });

    const out = await buildDependencyMeta({ cwd, stanPath, typescript: {} });
    const nodeIds = Object.keys(out.meta.nodes);

    // Builtin/missing omitted
    expect(nodeIds.some((id) => id.includes('node:'))).toBe(false);
    expect(nodeIds.some((id) => id.includes('./nope'))).toBe(false);

    // Repo-local preserved
    expect(nodeIds).toEqual(expect.arrayContaining([srcId]));

    // NPM normalized
    const npmNorm = `${stanPath}/context/npm/pkg/1.0.0/index.d.ts`;
    expect(nodeIds).toEqual(expect.arrayContaining([npmNorm]));

    // ABS normalized and locatorAbs included
    const absNorm = nodeIds.find((id) =>
      id.startsWith(`${stanPath}/context/abs/`),
    );
    expect(absNorm).toBeTruthy();
    const absId = absNorm ?? '';
    const node = out.meta.nodes[absId];
    expect(node).toBeDefined();
    expect(node.locatorAbs).toBe(absFileAbs.replace(/\\/g, '/'));

    // Edges are preserved only among kept targets
    expect(out.meta.edges[srcId].some((e) => e.target === npmNorm)).toBe(true);
    expect(out.meta.edges[srcId].some((e) => e.target.includes('node:'))).toBe(
      false,
    );

    // Cleanup
    await cleanupTempDir(cwd);
    await cleanupTempDir(outside);
  });
});
