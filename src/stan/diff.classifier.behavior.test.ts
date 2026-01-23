import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withMockTarCapture } from '../test/helpers';
import type { SelectionReport } from './archive/report';
import { createArchiveDiff } from './diff';
const { calls } = withMockTarCapture('TAR');

describe('createArchiveDiff integrates classifier (excludes binaries, surfaces warnings via callback)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'stan-diff-class-'));
    calls.length = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('non-combine: excludes binaries and reports archive warnings via onArchiveWarnings', async () => {
    const out = 'out';
    // Prepare files in repo root; no snapshot present => diff = full filtered set
    await writeFile(
      path.join(dir, 'binary.bin'),
      Buffer.from([0x00, 0x01, 0x02]),
    ); // binary-ish
    await writeFile(path.join(dir, 'small.txt'), 'hello\n', 'utf8');

    const seen: string[] = [];
    const reports: SelectionReport[] = [];
    await createArchiveDiff({
      cwd: dir,
      stanPath: out,
      baseName: 'archive',
      includeOutputDirInDiff: false,
      updateSnapshot: 'createIfMissing',
      onArchiveWarnings: (t) => seen.push(t),
      onSelectionReport: (r) => {
        reports.push(r);
      },
    });

    const diffCall = calls.find((c) => c.file.endsWith('archive.diff.tar'));
    expect(diffCall).toBeTruthy();
    const files = diffCall?.files ?? [];

    // binary excluded
    expect(files).not.toEqual(expect.arrayContaining(['binary.bin']));
    // text included
    expect(files).toEqual(expect.arrayContaining(['small.txt']));

    // warnings surfaced via callback (engine does not log)
    const body = seen.join('\n');
    expect(body).toMatch(/Binary files excluded|Large text files/);

    // selection report surfaced via callback (engine does not log)
    const report = reports.at(0);
    expect(report).toBeTruthy();
    if (!report) throw new Error('expected onSelectionReport to be called');
    expect(report.kind).toBe('diff');
    expect(report.mode).toBe('denylist');
    expect(report.snapshotExists).toBe(false);
    expect(report.counts.selected).toBe(2);
    expect(report.counts.archived).toBe(1);
    expect(report.counts.excludedBinaries).toBe(1);
  });
});
