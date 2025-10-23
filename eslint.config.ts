import eslint from '@eslint/js';
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

  // TypeScript preset (type‑aware, closer to previous behavior)
  ...tseslint.configs.recommendedTypeChecked,

  // Our project override (parser/project + plugins/rules)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir,
      },
    },
    plugins: {
      prettier: prettierPlugin as unknown as Linter.Plugin,
      'simple-import-sort': simpleImportSortPlugin as unknown as Linter.Plugin,
      tsdoc: tsdoc as unknown as Linter.Plugin,
    },
    rules: {
      // Formatting via Prettier
      'prettier/prettier': ['error'],
      // Import ordering
      'simple-import-sort/imports': ['error'],
      'simple-import-sort/exports': ['error'],
      // TS preferences (parity with prior JS config)
      '@typescript-eslint/no-explicit-any': ['error'],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // TSDoc hygiene (quiet)
      'tsdoc/syntax': ['warn'],
      // Keep prior behavior; do not introduce stricter rules
      '@typescript-eslint/no-unnecessary-condition': ['off'],
      '@typescript-eslint/restrict-template-expressions': ['off'],
    } as const satisfies Linter.RulesRecord,
  },

  // Disable stylistic conflicts with Prettier
  (await import('eslint-config-prettier')).default as unknown as Linter.FlatConfig,

  // Tests
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { vitest: vitest as unknown as Linter.Plugin },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['off'],
      '@typescript-eslint/no-unsafe-assignment': ['off'],
      '@typescript-eslint/no-unsafe-return': ['off'],
      // Tests/mocks often wrap async without awaits.
      '@typescript-eslint/require-await': ['off'],
    } as const satisfies Linter.RulesRecord,
  },

  // JSON (no nested extends)
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc: jsonc as unknown as Linter.Plugin },
    rules: {
      ...(jsonc.configs['recommended-with-json']?.rules as Linter.RulesRecord),
    },
  },
];

export default config;
