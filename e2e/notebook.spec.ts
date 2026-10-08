import { expect, test } from '@playwright/test';

test('notebook: deck tabs, furigana, and the language toggle', async ({ page }) => {
  await page.goto('#/notebook');
  await expect(page.getByRole('heading', { name: 'Notebook' })).toBeVisible();
  const decks = page.getByRole('navigation', { name: 'Decks' });
  await expect(decks.getByRole('link', { name: 'All words' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await decks.getByRole('link', { name: 'Verbs · Group 2' }).click();
  await expect(page).toHaveURL(/#\/notebook\/verbs-g2$/);
  const taberu = page.locator('[data-word-id="taberu"]');
  await expect(taberu).toContainText('to eat');
  await expect(taberu).toContainText('べます');
  await expect(taberu.locator('rt').first()).toHaveText('た');
  await expect(taberu.getByText('G2')).toBeVisible();
  await expect(page.locator('[data-word-id="sensei"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Español' }).click();
  await expect(taberu).toContainText('comer');
  const mazos = page.getByRole('navigation', { name: 'Mazos' });
  await expect(mazos.getByRole('link', { name: 'Verbos · Grupo 2' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cuaderno' })).toBeVisible();
  await expect(taberu).toContainText('comer');
});
