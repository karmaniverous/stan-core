import { describe, expect, it } from 'vitest';

import { functionGuard, resolveExport } from './resolve-export';

describe('resolveExport (SSR-safe named-or-default export resolver)', () => {
  it('prefers named export when present', async () => {
    const fn = () => 'ok';
    const out = await resolveExport(
      () => Promise.resolve({ foo: fn }),
      'foo',
      functionGuard<() => string>(),
      { moduleLabel: 'x' },
    );
    expect(out()).toBe('ok');
  });

  it('falls back to default.<name> when named export is missing', async () => {
    const fn = () => 'ok';
    const out = await resolveExport(
      () => Promise.resolve({ default: { foo: fn } }),
      'foo',
      functionGuard<() => string>(),
      { moduleLabel: 'x' },
    );
    expect(out()).toBe('ok');
  });

  it('accepts callable default export when enabled', async () => {
    const fn = () => 'ok';
    const out = await resolveExport(
      () => Promise.resolve({ default: fn }),
      'foo',
      functionGuard<() => string>(),
      { moduleLabel: 'x', acceptCallableDefault: true },
    );
    expect(out()).toBe('ok');
  });

  it('throws a clear error when import fails', async () => {
    await expect(
      resolveExport(
        () => Promise.reject(new Error('boom')),
        'foo',
        functionGuard<() => string>(),
        { moduleLabel: 'x' },
      ),
    ).rejects.toThrow(/failed to import x: boom/);
  });

  it('throws when export cannot be resolved', async () => {
    await expect(
      resolveExport(
        () => Promise.resolve({ default: {} }),
        'foo',
        (v): v is string => {
          return typeof v === 'string';
        },
      ),
    ).rejects.toThrow(/export "foo" not found/);
  });
});
