import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Words come from data/words/ in the app and from the frozen fixtures in e2e and unit tests (SPEC §5.6). */
const wordsDir = (mode: string): string =>
  fileURLToPath(
    new URL(
      mode === 'e2e' || mode === 'test' ? './data/fixtures' : './data/words',
      import.meta.url,
    ),
  );

export default defineConfig(({ mode }) => ({
  base: '/tangocho/',
  plugins: [react()],
  resolve: {
    alias: {
      '@words': wordsDir(mode),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
