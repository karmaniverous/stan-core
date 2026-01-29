import { describe, expect, it } from 'vitest';

import { createArchiveFromFiles } from '@/stan';

describe('public API exports', () => {
  it('exports createArchiveFromFiles (allowlist full archive)', () => {
    expect(typeof createArchiveFromFiles).toBe('function');
  });
});
