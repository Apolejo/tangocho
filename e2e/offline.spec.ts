import { expect, test } from './test.ts';

/**
 * Installable and offline (SPEC §4): once the service worker has cached the app, a reload with
 * no network opens it, with its fonts, and a whole round plays. Chromium only: Playwright runs
 * service workers there alone. The phone check (ROADMAP M9) is the real one.
 */

test.use({ serviceWorkers: 'allow' });

test('the manifest names the app and its icons', async ({ page }) => {
  const manifest = await (await page.request.get('manifest.webmanifest')).json();
  expect(manifest).toMatchObject({
    name: '単語帳 Tangochō',
    short_name: '単語帳',
    display: 'standalone',
    start_url: '/tangocho/',
    scope: '/tangocho/',
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await page.request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  }
  const touch = await page.request.get('apple-touch-icon-180x180.png');
  expect(touch.status()).toBe(200);
});

test('once cached, it opens and plays a round offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright runs service workers in Chromium only');
  test.slow();

  // Settings, so no banner asks GitHub while the worker could hide the request from the mock
  await page.goto('#/settings');
  await expect(page.locator('[data-offline]')).toHaveAttribute('data-offline', 'ready', {
    timeout: 30_000,
  });

  await context.setOffline(true);
  const sameOrigin: { url: string; fromWorker: boolean }[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith('http://localhost:4173/')) {
      sameOrigin.push({ url: response.url(), fromWorker: response.fromServiceWorker() });
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();
  await expect(page.locator('[data-offline]')).toHaveAttribute('data-offline', 'ready');

  // the fonts come from the cache too: the slices for the brand and a word load in both faces
  const fonts = await page.evaluate<string[]>(`Promise.all([
    document.fonts.load('600 28px "Klee One"', '単語帳'),
    document.fonts.load('400 28px "Klee One"', '先生'),
    document.fonts.load('700 16px "Zen Kaku Gothic New"', '設定'),
  ]).then((sets) => sets.flat().map((face) => face.family + ' ' + face.weight + ' ' + face.status))`);
  expect(fonts.length).toBeGreaterThanOrEqual(3);
  for (const face of fonts) expect(face).toMatch(/ loaded$/);
  expect(
    await page.evaluate<number>(
      "[...document.fonts].filter((face) => face.status === 'error').length",
    ),
  ).toBe(0);

  await page.goto('#/play/quiz');
  await page.getByRole('radio', { name: '10 questions' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i + 1} / 10`);
    await page.keyboard.press('1');
    const next = page.getByRole('button', { name: 'Continue' });
    if (await next.isVisible()) await next.click();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

  expect(sameOrigin.length).toBeGreaterThan(0);
  expect(sameOrigin.filter((r) => !r.fromWorker)).toEqual([]);
});
