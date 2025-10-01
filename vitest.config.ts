/** See <stanPath>/system/stan.project.md for global requirements. */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['node_modules/**', 'dist/**', '.rollup.cache/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        '**/*.d.ts',
        // Exclude trivial barrels and types-only modules from coverage noise
        'src/index.ts',
        'src/stan/index.ts',
        'src/stan/config/index.ts',
        'src/stan/run/index.ts',
        'src/stan/patch/index.ts',
        'src/stan/config/types.ts',
        'src/stan/run/types.ts',
      ],
    },
    reporters: [
      [
        'default',
        {
          summary: false,
        },
      ],
    ],
    setupFiles: [
      resolve(rootDir, 'src/test/setup.ts'),
      resolve(rootDir, 'src/test/mock-tar.ts'),
    ],
    testTimeout: 15000,
    hookTimeout: 10000,
  },
});
