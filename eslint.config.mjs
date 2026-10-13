import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/out/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Headless core: forbid UI/Electron imports.
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'electron', 'electron/*', '@the-lab/ui'] },
      ],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/desktop/**/*.{js,cjs,mjs}', 'scripts/**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
