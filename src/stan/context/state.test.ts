import { describe, expect, it } from 'vitest';

import type { DependencyMetaFile } from './schema';
import { parseDependencyStateFile } from './schema';
import { computeSelectedNodeIds } from './state';

const makeMeta = (): Pick<DependencyMetaFile, 'edges'> => {
  return {
    edges: {
      'a.ts': [
        { target: 'b.ts', kind: 'runtime' },
        { target: 'c.ts', kind: 'type' },
      ],
      'b.ts': [{ target: 'd.ts', kind: 'dynamic' }],
      'c.ts': [{ target: 'd.ts', kind: 'type' }],
      'd.ts': [],
    },
  };
};

describe('dependency state closure', () => {
  it('depth=0 includes only the nodeId (no traversal)', () => {
    const meta = makeMeta();
    const st = parseDependencyStateFile({ include: [['a.ts', 0]] });
    const out = computeSelectedNodeIds({
      meta,
      include: st.include,
      exclude: st.exclude,
    });
    expect(out).toEqual(['a.ts']);
  });

  it('depth=1 includes direct outgoing deps (all kinds by default)', () => {
    const meta = makeMeta();
    const st = parseDependencyStateFile({ include: [['a.ts', 1]] });
    const out = computeSelectedNodeIds({
      meta,
      include: st.include,
      exclude: st.exclude,
    });
    expect(out).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('edgeKinds filters traversal (type-only)', () => {
    const meta = makeMeta();
    const st = parseDependencyStateFile({
      include: [['a.ts', 2, ['type']]],
    });
    const out = computeSelectedNodeIds({
      meta,
      include: st.include,
      exclude: st.exclude,
    });
    // a -> c (type), c -> d (type)
    expect(out).toEqual(['a.ts', 'c.ts', 'd.ts']);
  });

  it('excludes win (subtract after include expansion)', () => {
    const meta = makeMeta();
    const st = parseDependencyStateFile({
      include: [['a.ts', 2]],
      exclude: [['b.ts', 1]], // b and its dynamic dep d
    });
    const out = computeSelectedNodeIds({
      meta,
      include: st.include,
      exclude: st.exclude,
    });
    // include closure from a(depth=2): a,b,c,d (b->d dynamic, c->d type)
    // exclude closure from b(depth=1): b,d
    expect(out).toEqual(['a.ts', 'c.ts']);
  });
});
