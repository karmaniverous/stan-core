import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
// Stub dynamic deps module so we can simulate missing deps deterministically.
let typeScriptOk = true;
let graphFactory: (() => unknown) | null = null;
vi.mock('./deps', () => ({
  __esModule: true,
  loadTypeScript: () => {
    if (!typeScriptOk) throw new Error('no typescript');
    return Promise.resolve({});
  },
  loadStanContext: () => {
    return Promise.resolve({
      generateDependencyGraph: () =>
        Promise.resolve(graphFactory ? graphFactory() : { graph: {} }),
    });
  },
}));

import { buildDependencyMeta } from './build';

describe('buildDependencyMeta (context mode: deps + normalization)', () => {
  it('throws when TypeScript cannot be imported (only when invoked)', async () => {
    typeScriptOk = false;
    graphFactory = () => ({ graph: { nodes: {}, edges: {} } });

    await expect(
      buildDependencyMeta({ cwd: process.cwd(), stanPath: '.stan' }),
    ).rejects.toThrow(/requires TypeScript/i);

    typeScriptOk = true;
  });

  it('omits builtin/missing nodes and normalizes npm + abs externals', async () => {
    const cwd = await makeTempDir('stan-meta-build-');
    const stanPath = '.stan';

    // Create a fake package under node_modules/pkg
    const pkgRoot = path.join(cwd, 'node_modules', 'pkg');
    await mkdir(pkgRoot, { recursive: true });
    await writeFile(
      path.join(pkgRoot, 'package.json'),
      JSON.stringify({ name: 'pkg', version: '1.0.0' }, null, 2),
      'utf8',
    );
    const pkgFileAbs = path.join(pkgRoot, 'index.d.ts');
    await writeFile(pkgFileAbs, 'export {};\n', 'utf8');

    // Create an abs file outside repo root
    const outside = await makeTempDir('stan-abs-');
    const absFileAbs = path.join(outside, 'x.d.ts');
    await writeFile(absFileAbs, 'export type X = 1;\n', 'utf8');

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

    const out = await buildDependencyMeta({ cwd, stanPath });
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
    const absId = absNorm as string;
    expect(out.meta.nodes[absId].locatorAbs).toBe(
      absFileAbs.replace(/\\/g, '/'),
    );

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
