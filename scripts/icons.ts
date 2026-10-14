/**
 * `npm run icons`: the installed app's icons (SPEC §4), rendered from public/icon.svg with
 * Playwright's Chromium into public/. Run it after changing the drawing and commit the PNGs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

/** The manifest's icons (vite.config.ts), and the one iOS reads from index.html. */
const ICONS = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'maskable-512x512.png', size: 512 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
] as const;

const svg = readFileSync(`${PUBLIC}icon.svg`).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0"><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.locator('img').evaluate((img) => (img as { decode(): Promise<void> }).decode());
    await page.screenshot({ path: `${PUBLIC}${file}` });
    console.log(`  public/${file}`);
  }
} finally {
  await browser.close();
}
