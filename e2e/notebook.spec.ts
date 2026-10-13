import { expect, test } from './test.ts';

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

test('a tapped verb shows its eight forms, each with its ⚑', async ({ page, isMobile }) => {
  await page.goto('#/notebook/verbs-g1');
  const verb = page.getByRole('button', { name: 'Show the forms of 書きます' });
  if (isMobile) await verb.tap();
  else await verb.click();

  const sheet = page.getByRole('dialog', { name: '書く（かく）' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Group 1');
  await expect(sheet).toContainText('to write');
  const forms = {
    辞書形: '書く',
    ます: '書きます',
    ません: '書きません',
    ました: '書きました',
    ませんでした: '書きませんでした',
    て: '書いて',
    ない: '書かない',
    た: '書いた',
  };
  await expect(sheet.locator('tr[data-form]')).toHaveCount(8);
  for (const [form, written] of Object.entries(forms)) {
    const cell = sheet.locator(`tr[data-form="${form}"] td`).first();
    // the written form with its furigana: 書(か)いて
    await expect(cell.locator('rt')).toHaveText('か');
    await expect(cell).toHaveText(written.replace('書', '書(か)'));
  }

  // each form's ⚑ opens a new issue with the form and the app's answer filled in
  const flag = sheet.locator('tr[data-form="て"] [data-report]');
  await expect(flag).toHaveAttribute('target', '_blank');
  const url = new URL((await flag.getAttribute('href')) ?? '');
  expect(url.searchParams.get('labels')).toBe('word-report');
  expect(url.searchParams.get('title')).toBe('Word report: 書きます · て形 (kaku)');
  expect(url.searchParams.get('body')).toContain('- **App’s answer:** 書いて（かいて）');
  expect(url.searchParams.get('body')).toContain('- **From:** Notebook');

  // closes with ✕ (or Esc), and with a tap outside it
  if (isMobile) {
    await sheet.getByRole('button', { name: 'Close' }).tap();
  } else {
    await page.keyboard.press('Escape');
    await expect(verb).toBeFocused();
  }
  await expect(sheet).toBeHidden();
  if (isMobile) await verb.tap();
  else await verb.click();
  await expect(sheet).toBeVisible();
  // the top corner of the page is backdrop, both beside the dialog and above the sheet
  if (isMobile) await page.touchscreen.tap(5, 5);
  else await page.mouse.click(5, 5);
  await expect(sheet).toBeHidden();
});

test('every word has its ⚑; only verbs open forms', async ({ page }) => {
  await page.goto('#/notebook/occupations');
  const sensei = page.locator('[data-word-id="sensei"]');
  await expect(sensei.getByRole('button')).toHaveCount(0);
  const flag = sensei.getByRole('link', { name: 'Report a mistake in 先生' });
  const url = new URL((await flag.getAttribute('href')) ?? '');
  expect(url.origin + url.pathname).toBe('https://github.com/Apolejo/tangocho/issues/new');
  expect(url.searchParams.get('title')).toBe('Word report: 先生 (sensei)');
});
