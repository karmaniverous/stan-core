/* src/stan/patch/common/file-ops.ts
 * Shared extractor for the unfenced "### File Ops" block.
 */

/** Extract unfenced File Ops body: lines after "### File Ops" up to the next heading or EOF. */
export const extractFileOpsBody = (text: string): string | null => {
  const headingRe = /^###\s+File Ops\s*$/m;
  const hm = headingRe.exec(text);
  if (!hm) return null;
  const afterIdx = (hm.index ?? 0) + hm[0].length;
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

export default {
  extractFileOpsBody,
};
