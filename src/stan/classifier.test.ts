import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../test/tmp';
import { classifyForArchive } from './classifier';

describe('archive classifier (binary exclusion + large text flags)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await makeTempDir('stan-class-');
  });

  afterEach(async () => {
    await cleanupTempDir(dir);
  });

  it('excludes binaries and flags large text (not excluded)', async () => {
    const binRel = 'image.bin';
    const largeRel = 'big.txt';
    const smallRel = 'readme.md';

    // Binary-ish content (includes NULs)
    await writeFile(
      path.join(dir, binRel),
      Buffer.from([0x00, 0x01, 0x02, 0x00]),
    );
    // Large text (LOC > 3000)
    const largeBody = Array.from({ length: 3001 }, () => 'x').join('\n') + '\n';
    await writeFile(path.join(dir, largeRel), largeBody, 'utf8');
    // Small text
    await writeFile(path.join(dir, smallRel), '# hello\n', 'utf8');

    const rels = [binRel, largeRel, smallRel];
    const out = await classifyForArchive(dir, rels);

    // Binary excluded
    const excluded = out.excludedBinaries.map((e) => e.path);
    expect(excluded).toEqual(expect.arrayContaining([binRel]));
    // Text files remain
    expect(out.textFiles).toEqual(expect.arrayContaining([largeRel, smallRel]));
    expect(out.textFiles).not.toEqual(expect.arrayContaining([binRel]));
    // Large text flagged (not excluded)
    const flagged = out.largeText.map((t) => t.path);
    expect(flagged).toEqual(expect.arrayContaining([largeRel]));
    // Warnings present
    expect(out.warningsBody.length).toBeGreaterThan(0);
    expect(out.warningsBody).toMatch(/Binary files excluded/);
    expect(out.warningsBody).toMatch(/Large text files/);
  });
});
