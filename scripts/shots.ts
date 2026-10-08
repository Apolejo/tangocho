/**
 * `npm run shots`: screenshots of every screen at phone and desktop size, light and dark, into
 * shots/ (SPEC §14). Starts the dev server itself. `--only <screen>` limits to one screen,
 * `--full` captures the whole page instead of the viewport.
 */
import { mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../shots/', import.meta.url));

/** Add a line here when a screen appears. */
const SCREENS = [
  { name: 'notebook', hash: '#/notebook' },
  { name: 'notebook-verbs-g2', hash: '#/notebook/verbs-g2' },
  { name: 'fonts', hash: '#/dev/fonts', dev: true },
];

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
];

const SCHEMES = ['light', 'dark'] as const;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const only = arg('--only');
  const fullPage = process.argv.includes('--full');
  // dev-only screens (the font tryout) are shot only when asked for by name
  const screens = SCREENS.filter((s) => (only === undefined ? s.dev !== true : s.name === only));
  if (screens.length === 0) throw new Error(`no screen named "${only}"`);

  const server = await createServer({ root: ROOT, logLevel: 'silent' });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error('dev server has no local URL');
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const screen of screens) {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of SCHEMES) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            colorScheme,
            locale: 'en-US',
          });
          const page = await context.newPage();
          await page.goto(url + screen.hash, { waitUntil: 'networkidle' });
          await page.evaluate('document.fonts.ready');
          const file = `${OUT}${screen.name}-${viewport.name}-${colorScheme}.png`;
          await page.screenshot({ path: file, fullPage });
          console.log(`  ${relative(ROOT, file)}`);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
