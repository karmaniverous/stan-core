/**
 * EOL normalization helpers for patch/text processing; pure string transforms.
 * @module
 */
export const toLF = (s: string): string =>
  s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const ensureFinalLF = (s: string): string =>
  s.endsWith('\n') ? s : s + '\n';

export default { toLF, ensureFinalLF };
