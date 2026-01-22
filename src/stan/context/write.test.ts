import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeDependencyMetaFile } from './write';

describe('writeDependencyMetaFile', () => {
  it('writes <stanPath>/context/dependency.meta.json with trailing newline', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'stan-meta-write-'));
    try {
      const abs = await writeDependencyMetaFile({
        cwd,
        stanPath: '.stan',
        meta: { schemaVersion: 1, nodes: {}, edges: {} },
      } as unknown as Parameters<typeof writeDependencyMetaFile>[0]);

      const body = await readFile(abs, 'utf8');
      expect(body.endsWith('\n')).toBe(true);
      expect(() => {
        JSON.parse(body);
      }).not.toThrow();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
