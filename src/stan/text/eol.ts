/* src/stan/text/eol.ts
 * EOL normalization helpers.
 */
export const toLF = (s: string): string =>
  s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const ensureFinalLF = (s: string): string =>
  s.endsWith('\n') ? s : s + '\n';

export default { toLF, ensureFinalLF };
