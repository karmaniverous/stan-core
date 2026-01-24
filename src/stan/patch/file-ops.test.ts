import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cleanupTempDir, makeTempDir } from '../../test/tmp';
import type { FileOp } from './file-ops';
import { executeFileOps, parseFileOpsBlock } from './file-ops';

const msg = [
  '## UPDATED: docs',
  '',
  '### File Ops',
  'mkdirp src/new/dir',
  'mv src/old.txt src/new/dir/new.txt',
  'rm src/tmp.bin',
  'rmdir src/legacy/empty',
  '',
  '### Patch: docs',
  '```',
  'diff --git a/README.md b/README.md',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
  '```',
  '',
].join('\n');

describe('file-ops parser', () => {
  it('extracts verbs and normalized repo-relative paths', () => {
    const plan = parseFileOpsBlock(msg);
    expect(plan.errors.length).toBe(0);
    expect(plan.ops.length).toBe(4);
    expect(plan.ops[0]).toEqual({ verb: 'mkdirp', src: 'src/new/dir' });
    expect(plan.ops[1]).toEqual({
      verb: 'mv',
      src: 'src/old.txt',
      dest: 'src/new/dir/new.txt',
    });
    expect(plan.ops[2]).toEqual({ verb: 'rm', src: 'src/tmp.bin' });
    expect(plan.ops[3]).toEqual({ verb: 'rmdir', src: 'src/legacy/empty' });
  });

  it('rejects absolute and traversal paths', () => {
    const bad = ['### File Ops', 'rm /etc/passwd', 'mv src/a ../b'].join('\n');
    const plan = parseFileOpsBlock(bad);
    expect(plan.ops.length).toBe(0);
    expect(plan.errors.some((e) => /invalid repo-relative path/.test(e))).toBe(
      true,
    );
  });
});

describe('file-ops execution (recursive mv/rm)', () => {
  it('mv moves a directory tree; rm removes a non-empty directory', async () => {
    const root = await makeTempDir('stan-fops-');
    // Create a small tree: a/dir/file.txt
    const aDir = path.join(root, 'a', 'dir');
    await mkdir(aDir, { recursive: true });
    await writeFile(path.join(aDir, 'file.txt'), 'x\n', 'utf8');
    // Plan: mkdirp b; mv a b; rm b (recursive)
    const ops = [
      { verb: 'mkdirp', src: 'b' as string },
      { verb: 'mv', src: 'a', dest: 'b/a' },
      { verb: 'rm', src: 'b' },
    ] as const;
    const { ok, results } = await executeFileOps(
      root,
      ops as unknown as FileOp[],
      false,
    );
    expect(ok).toBe(true);
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok']); // Verify final state: neither a/ nor b/ exists
    const s = async (p: string) => {
      try {
        await readFile(path.join(root, p));
        return true;
      } catch {
        return false;
      }
    };
    expect(await s('a/dir/file.txt')).toBe(false);
    expect(await s('b/a/dir/file.txt')).toBe(false);
    await cleanupTempDir(root);
  });

  it('cp copies a file and creates parent directories (no overwrite)', async () => {
    const root = await makeTempDir('stan-fops-cp-');
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src', 'a.txt'), 'hello\n', 'utf8');

    const ops = [
      { verb: 'cp', src: 'src/a.txt', dest: 'dest/sub/b.txt' },
    ] as const;
    const out = await executeFileOps(root, ops as unknown as FileOp[], false);
    expect(out.ok).toBe(true);
    expect(out.results[0]?.status).toBe('ok');

    const srcBody = await readFile(path.join(root, 'src', 'a.txt'), 'utf8');
    const dstBody = await readFile(
      path.join(root, 'dest', 'sub', 'b.txt'),
      'utf8',
    );
    expect(srcBody).toBe('hello\n');
    expect(dstBody).toBe('hello\n');

    // Second attempt should fail due to no-overwrite behavior
    const out2 = await executeFileOps(root, ops as unknown as FileOp[], false);
    expect(out2.ok).toBe(false);
    expect(out2.results[0]?.status).toBe('failed');
    expect(out2.results[0]?.message ?? '').toMatch(/destination exists/i);

    await cleanupTempDir(root);
  });
});
