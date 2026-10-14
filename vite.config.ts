import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { codePointsOf, fontFaceRanges, selectFontSlices } from './scripts/font-slices.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Words come from data/words/ in the app and from the frozen fixtures in e2e and unit tests (SPEC §5.6). */
const wordsDir = (mode: string): string =>
  join(root, mode === 'e2e' || mode === 'test' ? 'data/fixtures' : 'data/words');

/** About shows the version, and the commit CI built (src/app/build.ts). */
const VERSION = (
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }
).version;
const COMMIT = process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';

/** The paper color (tokens.css, src/app/theme.ts), for the installed app's splash and bars. */
const PAPER = '#f6f1e7';

const filesIn = (dir: string, pattern: RegExp): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => pattern.test(name))
    .map((name) => join(dir, name));

/**
 * Precache only the font slices that cover a character the app can show (scripts/font-slices.ts):
 * its source (UI text and Japanese literals), the words of this build and the decks. The output
 * folder comes from the resolved config, so e2e's `--outDir dist-e2e` works.
 */
function fontSlices(mode: string): { plugin: Plugin; transform: Transform } {
  let outDir = '';
  return {
    plugin: {
      name: 'tangocho:out-dir',
      configResolved(config) {
        outDir = resolve(config.root, config.build.outDir);
      },
    },
    transform: (entries) => {
      const css = filesIn(join(outDir, 'assets'), /\.css$/).map((f) => readFileSync(f, 'utf8'));
      const faces = fontFaceRanges(css.join('\n'));
      if (faces.size === 0) throw new Error('font slices: no @font-face in the built CSS');
      const sources = [
        ...filesIn(join(root, 'src'), /\.(ts|tsx|css)$/).filter((f) => !f.endsWith('.test.ts')),
        join(root, 'index.html'),
        ...filesIn(wordsDir(mode), /\.json$/),
        join(root, 'data/decks.json'),
      ];
      const points = codePointsOf(sources.map((f) => readFileSync(f, 'utf8')));
      const { kept, dropped } = selectFontSlices(entries, faces, points);
      const fonts = kept.filter((e) => e.url.endsWith('.woff2'));
      const mb = fonts.reduce((sum, e) => sum + e.size, 0) / 2 ** 20;
      console.info(
        `font slices: precaching ${fonts.length} of ${fonts.length + dropped.length} (${mb.toFixed(1)} MB)`,
      );
      return { manifest: kept };
    },
  };
}

type Transform = (entries: { url: string; size: number; revision: string | null }[]) => {
  manifest: { url: string; size: number; revision: string | null }[];
};

export default defineConfig(({ mode }) => {
  const slices = fontSlices(mode);
  return {
    base: '/tangocho/',
    define: {
      __APP_VERSION__: JSON.stringify(VERSION),
      __APP_COMMIT__: JSON.stringify(COMMIT),
    },
    plugins: [
      react(),
      // installable and offline (SPEC §4); not in unit tests
      ...(mode === 'test'
        ? []
        : [
            slices.plugin,
            VitePWA({
              // a new version waits for Reload (src/app/pwa.ts), never swaps the app mid-round
              registerType: 'prompt',
              injectRegister: false,
              manifest: {
                id: '/tangocho/',
                name: '単語帳 Tangochō',
                short_name: '単語帳',
                description:
                  'Minigames for drilling the Japanese words from a handwritten study notebook.',
                display: 'standalone',
                background_color: PAPER,
                theme_color: PAPER,
                icons: [
                  { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                  {
                    src: 'maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                // never the .woff fallbacks: every browser with a service worker reads woff2
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                navigateFallback: 'index.html',
                cleanupOutdatedCaches: true,
                manifestTransforms: [slices.transform],
                // a slice left out of the precache is kept once a page has used it
                runtimeCaching: [
                  {
                    urlPattern: ({ request, sameOrigin }) =>
                      sameOrigin && request.destination === 'font',
                    handler: 'CacheFirst',
                    options: { cacheName: 'font-slices', expiration: { maxEntries: 600 } },
                  },
                ],
                // nothing else at runtime: the word-report count (api.github.com) is never cached
              },
            }),
          ]),
    ],
    resolve: {
      alias: {
        '@words': wordsDir(mode),
      },
    },
    test: {
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
      // tokens.css?raw is read by the theme and contrast tests; other CSS stays empty in tests
      css: { include: [/tokens\.css/] },
    },
  };
});
