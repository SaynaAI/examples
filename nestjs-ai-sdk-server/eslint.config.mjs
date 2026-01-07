// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Allow explicit any when necessary for external libraries
      '@typescript-eslint/no-explicit-any': 'warn',

      // Ensure floating promises are handled
      '@typescript-eslint/no-floating-promises': 'error',

      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Relax some strict rules for practicality with external libraries
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // Allow non-null assertions when we know the value exists
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Prefer nullish coalescing but don't error
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',

      // Prettier formatting
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // NestJS uses empty decorated classes for modules
      '@typescript-eslint/no-extraneous-class': 'off',

      // Allow checking conditions that TypeScript thinks are always truthy
      // (useful for runtime checks on client.ready, isRunning, etc.)
      '@typescript-eslint/no-unnecessary-condition': 'off',

      // Allow template literals with numbers
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],

      // Allow type conversions for safety
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
    },
  },
);
