import { describe, expect, it } from 'vitest';

import {
  asBool,
  asString,
  asStringArray,
  normalizeMaxUndos,
} from '@/stan/config/normalize';

describe('config normalize helpers', () => {
  it('asBool parses common truthy/falsey cases', () => {
    expect(asBool(true)).toBe(true);
    expect(asBool(false)).toBe(false);
    expect(asBool('true')).toBe(true);
    expect(asBool('1')).toBe(true);
    expect(asBool('false')).toBe(false);
    expect(asBool('0')).toBe(false);
    expect(asBool(1)).toBe(true);
    expect(asBool(0)).toBe(false);
    expect(asBool('nope')).toBeUndefined();
  });

  it('asString returns non-empty strings; otherwise undefined', () => {
    expect(asString('x')).toBe('x');
    expect(asString('')).toBeUndefined();
    expect(asString(123)).toBeUndefined();
  });

  it('asStringArray filters and normalizes only strings', () => {
    expect(asStringArray(['a', ' ', 'b'])).toEqual(['a', 'b']);
    expect(asStringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
    expect(asStringArray('not-an-array')).toBeUndefined();
  });

  it('normalizeMaxUndos coerces to integer with sane default', () => {
    expect(normalizeMaxUndos(5)).toBe(5);
    expect(normalizeMaxUndos('7')).toBe(7);
    expect(normalizeMaxUndos('0')).toBe(10);
    expect(normalizeMaxUndos('abc')).toBe(10);
  });
});
