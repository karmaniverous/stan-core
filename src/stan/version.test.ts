// src/stan/version.test.ts
import { describe, expect, it } from 'vitest';

import { CORE_VERSION } from '@/stan';

describe('CORE_VERSION export', () => {
  it('is a non-empty string', () => {
    expect(typeof CORE_VERSION).toBe('string');
    expect(CORE_VERSION.length).toBeGreaterThan(0);
    // semantic-ish: "x.y.z" shape
    expect(CORE_VERSION.split('.').length).toBeGreaterThanOrEqual(3);
  });
});
