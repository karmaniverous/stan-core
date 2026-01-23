import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../test/helpers';
void withMockTarCapture('TAR');

import { createArchive } from './archive';
import type { SelectionReport } from './archive/report';

describe('createArchive', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-arch-'));
    await writeFile(path.join(dir, 'a.txt'), 'A', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes archive.tar and excludes files under outputPath', async () => {
    const reports: SelectionReport[] = [];
    const out = await createArchive(dir, 'stan', {
      onSelectionReport: (r) => {
        reports.push(r);
      },
    });
    expect(typeof out).toBe('string');
    expect(out.endsWith('archive.tar')).toBe(true);
    expect(existsSync(path.join(dir, 'stan'))).toBe(true);
    expect(await readFile(out, 'utf8')).toBe('TAR');

    const report = reports.at(0);
    expect(report).toBeTruthy();
    if (!report) throw new Error('expected onSelectionReport to be called');
    expect(report.kind).toBe('archive');
    expect(report.mode).toBe('denylist');
    expect(report.counts.archived).toBe(1);
    expect(report.counts.excludedBinaries).toBe(0);
  });
});
