import { answerReports as answer, countOpenReports } from './reports.ts';
import { expect, test, type Page } from './test.ts';

/**
 * The open word reports banner (SPEC §5.7), only where Settings turns it on. GitHub's API is
 * answered here, never reached: two open issues and a pull request with the label (which doesn't
 * count).
 */

const banner = (page: Page) => page.getByRole('complementary', { name: 'Word reports' });
const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name }).click();

test('asks GitHub nothing until Settings turns the count on', async ({ page }) => {
  const asked = await answer(page, [{ number: 1 }, { number: 2 }]);
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await nav(page, 'Notebook');
  await expect(page.getByRole('heading', { name: 'Notebook' })).toBeVisible();
  await nav(page, 'Play');
  await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked.count).toBe(0);
  await expect(banner(page)).toBeHidden();

  await countOpenReports(page);
  await nav(page, 'Today');
  await expect(banner(page)).toContainText('2 open word reports');
  expect(asked.count).toBe(1);
});

test('counts the open reports once per launch, and links to them', async ({ page }) => {
  const asked = await answer(page, [{ number: 1 }, { number: 2 }, { number: 3, pull_request: {} }]);
  await countOpenReports(page);
  await page.goto('#/notebook');
  const link = banner(page).getByRole('link', { name: '2 open word reports' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  const url = new URL((await link.getAttribute('href')) ?? '');
  expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues');
  expect(url.searchParams.get('q')).toBe('is:issue is:open label:word-report');

  // the game list shows it too; a game's screens don't
  await nav(page, 'Play');
  await expect(banner(page)).toBeVisible();
  await page.getByRole('link', { name: /Quick quiz/ }).click();
  await expect(page.getByRole('heading', { name: /Quick quiz/ })).toBeVisible();
  await expect(banner(page)).toBeHidden();

  // ✕ hides it until the next launch
  await page.goto('#/notebook');
  await banner(page).getByRole('button', { name: 'Hide' }).click();
  await expect(banner(page)).toBeHidden();
  await nav(page, 'Play');
  await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  await expect(banner(page)).toBeHidden();
  expect(asked.count).toBe(1);

  // the switch stays on: the next launch asks again
  await page.reload();
  await expect(banner(page)).toBeVisible();
  expect(asked.count).toBe(2);
});

test('says "1 open word report" for one, in Spanish too', async ({ page }) => {
  await answer(page, [{ number: 7 }]);
  await countOpenReports(page);
  await page.goto('#/notebook');
  await expect(banner(page).getByRole('link')).toHaveText('1 open word report');
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('complementary', { name: 'Reportes de palabras' })).toContainText(
    '1 reporte de palabra abierto',
  );
});

test('shows nothing when GitHub fails', async ({ page }) => {
  const asked = await answer(page, { message: 'API rate limit exceeded' }, 403);
  await countOpenReports(page);
  await page.goto('#/notebook');
  await expect.poll(() => asked.count).toBe(1);
  await expect(page.getByRole('heading', { name: 'Notebook' })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});

test('asks nothing while offline', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false });
  });
  const asked = await answer(page, [{ number: 1 }]);
  await countOpenReports(page);
  await page.goto('#/notebook');
  await expect(page.getByRole('heading', { name: 'Notebook' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(asked.count).toBe(0);
  await expect(banner(page)).toBeHidden();
});
