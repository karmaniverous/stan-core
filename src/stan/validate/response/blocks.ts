/**
 * Helpers to extract heading-delimited blocks from assistant response text;
 * pure string parsing.
 * @module
 */
import { toPosix } from '@/stan/path/repo';

import type { Block } from './types';

const H_PATCH = /^###\s+Patch:\s+(.+?)\s*$/m;
const H_FULL = /^###\s+Full Listing:\s+(.+?)\s*$/m;
const H_COMMIT = /^##\s+Commit Message\s*$/m;
const H_ANY = /^##\s+.*$|^###\s+.*$/m;

/** Extract the body for a "## <Heading>" section up to the next heading or EOF. */
export const extractH2SectionBody = (
  text: string,
  heading: string,
): string | null => {
  const re = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$`,
    'm',
  );
  const m = re.exec(text);
  if (!m) return null;
  const afterIdx = m.index + m[0].length;
  const tail = text.slice(afterIdx);
  const lines = tail.split(/\r?\n/);
  // Skip leading blank lines
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  const bodyLines: string[] = [];
  for (; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^#{2,3}\s+/.test(l)) break;
    bodyLines.push(l);
  }
  const body = bodyLines.join('\n').trimEnd();
  return body.length ? body : null;
};

/** Find all headings and slice blocks up to the next heading or end. */
export const extractBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  const indices: number[] = [];
  const re = new RegExp(H_ANY.source, 'gm');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) indices.push(m.index);
  indices.push(text.length);

  for (let i = 0; i < indices.length - 1; i += 1) {
    const start = indices[i];
    const end = indices[i + 1];
    const chunk = text.slice(start, end);
    if (H_COMMIT.test(chunk)) {
      blocks.push({ kind: 'commit', start, body: chunk });
    } else {
      const mPatch = chunk.match(H_PATCH);
      if (mPatch?.[1])
        blocks.push({
          kind: 'patch',
          path: toPosix(mPatch[1].trim()),
          start,
          body: chunk,
        });
      const mFull = chunk.match(H_FULL);
      if (mFull?.[1])
        blocks.push({
          kind: 'full',
          path: toPosix(mFull[1].trim()),
          start,
          body: chunk,
        });
    }
  }
  return blocks;
};
