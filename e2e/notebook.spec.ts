import { readReport } from './reports.ts';
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

  // each form's ⚑ opens an email with the form and the app's answer filled in
  const flag = sheet.locator('tr[data-form="て"] [data-report]');
  await expect(flag).not.toHaveAttribute('target', /.*/);
  const report = readReport(await flag.getAttribute('href'));
  expect(report.to).toBe('no-reply@apolejo.dev');
  expect(report.subject).toBe('Word report: 書きます · て形 (kaku)');
  expect(report.fields).toMatchObject({
    Form: 'て形',
    'App’s answer': '書いて（かいて）',
    'Reported from': 'Notebook',
  });

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
  const report = readReport(await flag.getAttribute('href'));
  expect(report.to).toBe('no-reply@apolejo.dev');
  expect(report.subject).toBe('Word report: 先生 (sensei)');
  expect(report.fields).toMatchObject({ 'Word id': 'sensei', 'Shown as': '先生（せんせい）' });
});

test('on a computer, ‹ › scroll the deck tabs and the arrow keys switch decks', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone swipes the tabs; the keys are for a keyboard');
  await page.goto('#/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Notebook' })
    .click();
  const decks = page.getByRole('navigation', { name: 'Decks' });
  const all = decks.getByRole('link', { name: 'All words' });
  const katakana = decks.getByRole('link', { name: 'Katakana words' });
  const start = decks.locator('[data-scroll="start"]');
  const end = decks.locator('[data-scroll="end"]');

  // the tabs don't fit: › brings the hidden ones in, ‹ goes back
  await expect(katakana).not.toBeInViewport({ ratio: 1 });
  await expect(start).toHaveCount(0);
  await end.click();
  await expect(katakana).toBeInViewport({ ratio: 1 });
  await expect(end).toHaveCount(0);
  await start.click();
  await expect(all).toBeInViewport({ ratio: 1 });
  await expect(start).toHaveCount(0);
  await expect(page).toHaveURL(/#\/notebook$/);

  // the row is one Tab stop, the selected tab; arrows, Home and End open the others
  await all.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/notebook\/new$/);
  const newWords = decks.getByRole('link', { name: 'New this week' });
  await expect(newWords).toBeFocused();
  await expect(newWords).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('End');
  await expect(page).toHaveURL(/#\/notebook\/katakana$/);
  await expect(katakana).toBeFocused();
  await expect(katakana).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-word-id="koohii"]')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(all).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(katakana).toBeFocused();

  // Tab goes straight into the word list, and Shift+Tab straight back to the selected deck
  await page.keyboard.press('Tab');
  await expect(page.locator('ol [data-word-id]').first().getByRole('link')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(katakana).toBeFocused();

  // the arrows replace the history entry: Back goes to Today instead of walking the decks
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Today/ })).toBeVisible();
});
