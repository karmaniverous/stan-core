import { describe, expect, it } from 'vitest';

import { uniqSortedStrings } from './uniq';

describe('uniqSortedStrings', () => {
  it('trims, drops empty strings, de-dupes, and sorts', () => {
    const out = uniqSortedStrings([' b ', '', 'a', 'b', '  ', 'a']);
    expect(out).toEqual(['a', 'b']);
  });

  it('applies the optional normalize function before trimming/sorting', () => {
    const toPosix = (s: string) => s.replace(/\\/g, '/').replace(/^\.\/+/, '');
    const out = uniqSortedStrings(['.\\b', './a', 'b', 'a', ''], toPosix);
    expect(out).toEqual(['a', 'b']);
  });
});
