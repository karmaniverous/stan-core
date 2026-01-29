import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SelectionReport } from '@/stan/archive/report';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import { createArchiveDiffWithDependencyContext } from './archive-flow';
import {
  createContextArchiveDiffWithDependencyContext,
  createContextArchiveWithDependencyContext,
} from './context-archive';
import type { DependencyMapFile, DependencyMetaFile } from './schema';

const writeUtf8 = (p: string, body: string) => writeFile(p, body, 'utf8');

describe('onSelectionReport pass-through (context orchestration + dependency archive-flow)', () => {
  it('createContextArchiveWithDependencyContext forwards onSelectionReport to allowlist FULL', async () => {
    const cwd = await makeTempDir('stan-ctx-report-full-');
    const stanPath = '.stan';
    try {
      await mkdir(path.join(cwd, stanPath, 'system'), { recursive: true });
      await writeUtf8(
        path.join(cwd, stanPath, 'system', 'stan.system.md'),
        '# sys\n',
      );
      await writeUtf8(
        path.join(cwd, stanPath, 'system', 'stan.scratch.md'),
        '# scratch\n',
      );
      await mkdir(path.join(cwd, stanPath, 'context'), { recursive: true });
      await writeUtf8(
        path.join(cwd, stanPath, 'context', 'dependency.meta.json'),
        '{"v":2,"n":{}}\n',
      );
      await writeUtf8(path.join(cwd, 'README.md'), '# readme\n');

      const meta: DependencyMetaFile = { v: 2, n: {} };
      const map: DependencyMapFile = { v: 1, nodes: {} };
      const state = { v: 2, i: [] };

      const reports: SelectionReport[] = [];
      await createContextArchiveWithDependencyContext({
        cwd,
        stanPath,
        dependency: { meta, map, state, clean: true },
        archive: {
          onSelectionReport: (r) => {
            reports.push(r);
          },
        },
      });

      expect(reports.length).toBe(1);
      const r = reports[0];
      expect(r.kind).toBe('archive');
      if (r.kind !== 'archive') throw new Error('expected archive report');
      expect(r.mode).toBe('allowlist');
      expect(r.stanPath).toBe(stanPath);
      expect(r.includeOutputDir).toBe(false);
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('createContextArchiveDiffWithDependencyContext forwards onSelectionReport to allowlist DIFF', async () => {
    const cwd = await makeTempDir('stan-ctx-report-diff-');
    const stanPath = '.stan';
    try {
      await mkdir(path.join(cwd, stanPath, 'system'), { recursive: true });
      await writeUtf8(
        path.join(cwd, stanPath, 'system', 'stan.system.md'),
        '# sys\n',
      );
      await mkdir(path.join(cwd, stanPath, 'context'), { recursive: true });
      await writeUtf8(
        path.join(cwd, stanPath, 'context', 'dependency.meta.json'),
        '{"v":2,"n":{}}\n',
      );
      await writeUtf8(path.join(cwd, 'README.md'), '# readme\n');

      const meta: DependencyMetaFile = { v: 2, n: {} };
      const map: DependencyMapFile = { v: 1, nodes: {} };
      const state = { v: 2, i: [] };

      const reports: SelectionReport[] = [];
      await createContextArchiveDiffWithDependencyContext({
        cwd,
        stanPath,
        dependency: { meta, map, state, clean: true },
        diff: {
          baseName: 'archive',
          updateSnapshot: 'replace',
          snapshotFileName: '.archive.snapshot.context.json',
          onSelectionReport: (r) => {
            reports.push(r);
          },
        },
      });

      expect(reports.length).toBe(1);
      const r = reports[0];
      expect(r.kind).toBe('diff');
      if (r.kind !== 'diff') throw new Error('expected diff report');
      expect(r.mode).toBe('allowlist');
      expect(r.stanPath).toBe(stanPath);
      expect(r.updateSnapshot).toBe('replace');
    } finally {
      await cleanupTempDir(cwd);
    }
  });

  it('createArchiveDiffWithDependencyContext forwards onSelectionReport to denylist DIFF', async () => {
    const cwd = await makeTempDir('stan-ctx-report-deny-diff-');
    const stanPath = '.stan';
    try {
      await writeUtf8(path.join(cwd, 'a.txt'), 'a\n');

      const meta: DependencyMetaFile = { v: 2, n: {} };
      const map: DependencyMapFile = { v: 1, nodes: {} };

      const reports: SelectionReport[] = [];
      await createArchiveDiffWithDependencyContext({
        cwd,
        stanPath,
        dependency: { meta, map, clean: true },
        diff: {
          baseName: 'archive',
          updateSnapshot: 'createIfMissing',
          onSelectionReport: (r) => {
            reports.push(r);
          },
        },
      });

      expect(reports.length).toBe(1);
      const r = reports[0];
      expect(r.kind).toBe('diff');
      if (r.kind !== 'diff') throw new Error('expected diff report');
      expect(r.mode).toBe('denylist');
      expect(r.stanPath).toBe(stanPath);
    } finally {
      await cleanupTempDir(cwd);
    }
  });
});
