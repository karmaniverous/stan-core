import { describe, expect, it } from 'vitest';

import { makeGlobMatcher } from './fs/match';

describe('makeGlobMatcher (engine-parity semantics)', () => {
  it('matches prefixes when pattern has no glob chars', () => {
    const m = makeGlobMatcher(['packages/app']);
    expect(m('packages/app/src/index.ts')).toBe(true);
    expect(m('packages/app')).toBe(true);
    expect(m('packages/app2')).toBe(false);
  });

  it('honors dot=true for glob patterns', () => {
    const m = makeGlobMatcher(['**/*.md']);
    expect(m('README.md')).toBe(true);
    expect(m('.hidden.md')).toBe(true);
  });

  it('normalizes Windows-style and ./ prefixes', () => {
    const m = makeGlobMatcher(['docs/guide']);
    expect(m('docs/guide/intro.md')).toBe(true);
    expect(m('.\\docs\\guide\\intro.md')).toBe(true);
    expect(m('./docs/guide/intro.md')).toBe(true);
  });

  it('returns false when no patterns supplied', () => {
    const m = makeGlobMatcher([]);
    expect(m('x')).toBe(false);
  });
});
