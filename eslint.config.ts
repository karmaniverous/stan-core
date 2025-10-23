import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import tsdoc from 'eslint-plugin-tsdoc';
import vitest from '@vitest/eslint-plugin';
import jsonc from 'eslint-plugin-jsonc';
import jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

const config: Linter.FlatConfig[] = [
  // Ignore generated and third‑party artifacts
  {
    ignores: [
      'dist/**',
      '.rollup.cache/**',
      'coverage/**',
      'node_modules/**',
      'docs/**',
      'rollup.config-*.mjs',
      '.stan/**',
    ],
  },

  // Base JS
  eslint.configs.recommended,

  // TypeScript (strict, type-aware under src/**)
  ...tseslint.configs.strictTypeChecked.map((c) => ({
    ...c,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      ...c.languageOptions,
      // Important: keep the TS parser and explicit project for type-aware linting
      parser: tseslint.parser,
      parserOptions: {
        ...(c.languageOptions?.parserOptions ?? {}),
        project: ['./tsconfig.json'],
        tsconfigRootDir,
      },
    },
    plugins: {
      ...(c.plugins ?? {}),
      prettier: prettierPlugin,
      'simple-import-sort': simpleImportSortPlugin,
      tsdoc,
    },
    rules: {
      ...(c.rules ?? {}),
      // Formatting via Prettier
      'prettier/prettier': 'error',
      // Import ordering
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // TS preferences
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // TSDoc hygiene (quiet)
      'tsdoc/syntax': 'warn',
    },
  })),

  // Disable stylistic conflicts with Prettier
  prettierConfig,

  // Tests
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { vitest },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Tests/mocks often wrap async without awaits.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // JSON (no nested extends)
  (() => {
    const jsoncRecommendedWithJson =
      (jsonc.configs['recommended-with-json'] as Linter.FlatConfig) ?? {};
    return {
      files: ['**/*.json'],
      languageOptions: { parser: jsoncParser },
      plugins: { jsonc },
      rules: {
        ...(jsoncRecommendedWithJson.rules ?? {}),
      },
    } satisfies Linter.FlatConfig;
  })(),
];

export default config;
