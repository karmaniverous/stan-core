import { describe, expect, it } from 'vitest';

import { detectAndCleanPatch } from './clean';

describe('detectAndCleanPatch (tilde fenced payloads)', () => {
  it('unwraps a ~~~~ wrapper that encloses the entire payload', () => {
    const rel = 'README.md';
    const raw = [
      '~~~~',
      `diff --git a/${rel} b/${rel}`,
      `--- a/${rel}`,
      `+++ b/${rel}`,
      '@@ -1,4 +1,4 @@',
      ' # Title',
      ' ```bash',
      '-echo old',
      '+echo new',
      ' ```',
      '~~~~',
      '',
    ].join('\n');

    const cleaned = detectAndCleanPatch(raw);
    expect(cleaned.startsWith('diff --git ')).toBe(true);
    expect(cleaned.includes('\n~~~~\n')).toBe(false);
    expect(cleaned.endsWith('\n')).toBe(true);
  });

  it('extracts the first unified diff from a ~~~~ fenced block inside chat text', () => {
    const rel = 'README.md';
    const raw = [
      'Here you go:',
      '',
      '~~~~',
      `diff --git a/${rel} b/${rel}`,
      `--- a/${rel}`,
      `+++ b/${rel}`,
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      '~~~~',
      '',
      'Thanks!',
      '',
    ].join('\n');

    const cleaned = detectAndCleanPatch(raw);
    expect(cleaned.startsWith('diff --git ')).toBe(true);
    expect(cleaned.includes('Here you go:')).toBe(false);
    expect(cleaned.includes('Thanks!')).toBe(false);
    expect(cleaned.endsWith('\n')).toBe(true);
  });

  it('does not treat a diff context line " ~~~~" as a closing fence', () => {
    const rel = 'README.md';
    const raw = [
      'Here you go:',
      '',
      '~~~~',
      `diff --git a/${rel} b/${rel}`,
      `--- a/${rel}`,
      `+++ b/${rel}`,
      '@@ -1,3 +1,3 @@',
      '-old',
      '+new',
      ' ~~~~',
      ' keep',
      '~~~~',
      '',
    ].join('\n');

    const cleaned = detectAndCleanPatch(raw);
    expect(cleaned.startsWith('diff --git ')).toBe(true);
    // The context line containing "~~~~" must still be present in the cleaned diff.
    expect(cleaned).toContain('\n ~~~~\n');
    // And content after that line must not be truncated.
    expect(cleaned).toContain('\n keep\n');
    expect(cleaned.endsWith('\n')).toBe(true);
  });
});
