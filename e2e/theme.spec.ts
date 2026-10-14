import { expect, test, type Page } from './test.ts';

/**
 * The theme (SPEC §13, §7.7): the night notebook follows the system, and Settings can force light
 * or dark. The choice is applied before the first paint and survives a reload.
 */

const LIGHT_PAPER = 'rgb(246, 241, 231)';
const DARK_PAPER = 'rgb(23, 28, 39)';

// page code as strings, so it runs in the page (e2e has no DOM types)
const paper = (page: Page) =>
  page.evaluate<string>('getComputedStyle(document.body).backgroundColor');

const themeColors = (page: Page) =>
  page.evaluate<string[]>(
    '[...document.querySelectorAll(\'meta[name="theme-color"]\')].map((meta) => meta.content)',
  );

/** A color-mix() token, painted on a probe: it must resolve in both schemes. */
const washi = (page: Page) =>
  page.evaluate<string>(`(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--washi)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  })()`);

/** Records the theme at the moment <body> is parsed, before any module script runs. */
async function watchFirstPaint(page: Page): Promise<void> {
  await page.addInitScript(`
    new MutationObserver((_, observer) => {
      if (document.body === null) return;
      window.themeAtBody = document.documentElement.dataset.theme ?? 'system';
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  `);
}

const themeAtBody = (page: Page) => page.evaluate<string | undefined>('window.themeAtBody');

test.describe('with the system in light mode', () => {
  test.use({ colorScheme: 'light' });

  test('System is the default and follows it; Dark overrides it and survives a reload', async ({
    page,
  }) => {
    await page.goto('#/settings');
    await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(await paper(page)).toBe(LIGHT_PAPER);
    const lightWashi = await washi(page);
    expect(lightWashi).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

    await page.getByRole('radio', { name: 'Dark' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await paper(page)).toBe(DARK_PAPER);
    expect(await themeColors(page)).toEqual(['#171c27', '#171c27']);
    const darkWashi = await washi(page);
    expect(darkWashi).not.toBe(lightWashi);

    await watchFirstPaint(page);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(await themeAtBody(page)).toBe('dark');
    expect(await paper(page)).toBe(DARK_PAPER);
    expect(await themeColors(page)).toEqual(['#171c27', '#171c27']);

    await page.getByRole('radio', { name: 'System' }).check();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await paper(page)).toBe(LIGHT_PAPER);
    expect(await themeColors(page)).toEqual(['#f6f1e7', '#171c27']);
  });
});

test.describe('with the system in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('System follows it; Light overrides it, and resetting progress keeps the theme', async ({
    page,
  }) => {
    await page.goto('#/settings');
    expect(await paper(page)).toBe(DARK_PAPER);

    await page.getByRole('radio', { name: 'Light' }).check();
    expect(await paper(page)).toBe(LIGHT_PAPER);
    expect(await themeColors(page)).toEqual(['#f6f1e7', '#f6f1e7']);

    await page.getByRole('button', { name: 'Reset progress' }).click();
    await page.getByRole('button', { name: 'Yes, delete it' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.locator('[data-transfer-status]')).toHaveText('Progress deleted.');

    await watchFirstPaint(page);
    await page.reload();
    expect(await themeAtBody(page)).toBe('light');
    await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });
});
