import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createArchiveWithDependencyContext } from './archive-flow';
import type { NodeSource } from './build';

describe('createArchiveWithDependencyContext (staging + anchors)', () => {
  let dir: string;
  let calls: Array<{
    file: string;
    cwd?: string;
    filter?: (p: string, s: unknown) => boolean;
    files: string[];
  }>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-ctx-arch-'));
    // Capture tar calls; dynamic import to avoid SSR/mock ordering issues.
    const helpers = (await import('../../test/helpers')) as typeof import('../../test/helpers');
    const state = helpers.withMockTarCapture('TAR');
    calls = state.calls;
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('stages only selected external nodeIds and includes .stan/context/** even when gitignored', async () => {
    const stanPath = '.stan';

    // Ignore .stan/context to prove anchors are required.
    await writeFile(path.join(dir, '.gitignore'), '.stan/context/\n', 'utf8');

    // A repo-local node to seed selection.
    await mkdir(path.join(dir, 'src'), { recursive: true });
    await writeFile(
      path.join(dir, 'src', 'a.ts'),
      'export const a = 1;\n',
      'utf8',
    );

    // External source file to be staged into .stan/context/npm/...
    await mkdir(path.join(dir, 'external'), { recursive: true });
    const srcAbs = path.join(dir, 'external', 'index.d.ts');
    const body = 'export type X = 1;\n';
    await writeFile(srcAbs, body, 'utf8');

    const nodeId = '.stan/context/npm/pkg/1.0.0/index.d.ts';

    const meta = {
      // minimal meta shape for closure: edges must contain keys for referenced nodeIds
      nodes: {
        'src/a.ts': { kind: 'source' as const },
        [nodeId]: {
          kind: 'external' as const,
          metadata: { hash: '', size: body.length },
        },
      },
      edges: {
        'src/a.ts': [{ target: nodeId, kind: 'type' as const }],
        [nodeId]: [],
      },
    };

    // Fill correct hash after file is written
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256')
      .update(Buffer.from(body, 'utf8'))
      .digest('hex');
    (
      meta.nodes[nodeId] as { metadata: { hash: string; size: number } }
    ).metadata.hash = hash;

    const sources: Record<string, NodeSource> = {
      [nodeId]: {
        kind: 'npm',
        sourceAbs: srcAbs.replace(/\\/g, '/'),
        pkgName: 'pkg',
        pkgVersion: '1.0.0',
        pathInPackage: 'index.d.ts',
      },
    };

    const state = { include: [['src/a.ts', 1]], exclude: [] };

    await createArchiveWithDependencyContext({
      cwd: dir,
      stanPath,
      dependency: { meta, state, sources, clean: true },
      archive: { includeOutputDir: false },
    });

    // Staged file exists in repo under .stan/context/... even though gitignored
    const stagedAbs = path.join(dir, ...nodeId.split('/'));
    const stagedBody = await readFile(stagedAbs, 'utf8');
    expect(stagedBody).toBe(body);

    // Archive includes staged file (via anchors)
    const call = calls.find((c) => c.file.endsWith('archive.tar'));
    expect(call).toBeTruthy();
    const files = call?.files ?? [];
    expect(files).toEqual(expect.arrayContaining([nodeId]));
  });
});
