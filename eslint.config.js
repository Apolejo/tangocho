import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-e2e',
    'node_modules',
    'shots',
    'playwright-report',
    'test-results',
    '.claude/worktrees', // the app's worktrees for other sessions: each lints itself
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      // this checkout's tsconfig, not one of a worktree the app keeps under .claude/worktrees/
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  prettier,
]);
