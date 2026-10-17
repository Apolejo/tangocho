import { expect, test } from './test.ts';

/**
 * Thanks (SPEC §7.1): a small chip on Today opens the thanks links in a sheet. Nothing opens by
 * itself, and the chip is never on a game's screens.
 */

const LINKS = {
  'My sensei': 'https://www.instagram.com/heros.to.nihongo/',
  'Made by @apolejoo': 'https://www.instagram.com/apolejoo/',
  'Buy me a coffee': 'https://paypal.me/apolejo',
};

test('Thanks on Today opens the three links in a sheet', async ({ page, isMobile }) => {
  await page.goto('#/');
  const thanks = page.getByRole('button', { name: 'Thanks' });
  await expect(thanks).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (isMobile) await thanks.tap();
  else await thanks.click();

  const sheet = page.getByRole('dialog', { name: 'Thanks ありがとう' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('If the app helps you, you can say thanks.');
  await expect(sheet.getByRole('link')).toHaveCount(3);
  for (const [name, href] of Object.entries(LINKS)) {
    const link = sheet.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(sheet.getByRole('link', { name: 'My sensei' })).toContainText('@heros.to.nihongo');

  // closes with ✕ (or Esc), and with a tap outside it
  if (isMobile) {
    await sheet.getByRole('button', { name: 'Close' }).tap();
  } else {
    await page.keyboard.press('Escape');
    await expect(thanks).toBeFocused();
  }
  await expect(sheet).toBeHidden();
  if (isMobile) await thanks.tap();
  else await thanks.click();
  await expect(sheet).toBeVisible();
  // the top corner of the page is backdrop, both beside the dialog and above the sheet
  if (isMobile) await page.touchscreen.tap(5, 5);
  else await page.mouse.click(5, 5);
  await expect(sheet).toBeHidden();
});

test('Thanks in Spanish', async ({ page }) => {
  await page.goto('#/');
  await page.getByRole('button', { name: 'Español' }).click();
  await page.getByRole('button', { name: 'Gracias' }).click();
  const sheet = page.getByRole('dialog', { name: 'Gracias ありがとう' });
  await expect(sheet).toContainText('Si la app te ayuda, puedes dar las gracias.');
  await expect(sheet.getByRole('link', { name: 'Mi sensei' })).toHaveAttribute(
    'href',
    LINKS['My sensei'],
  );
  await expect(sheet.getByRole('link', { name: 'Hecho por @apolejoo' })).toHaveAttribute(
    'href',
    LINKS['Made by @apolejoo'],
  );
  await expect(sheet.getByRole('link', { name: 'Invítame a un café' })).toHaveAttribute(
    'href',
    LINKS['Buy me a coffee'],
  );
  await expect(sheet.getByRole('button', { name: 'Cerrar' })).toBeVisible();
});

test("Thanks is never on a game's screens: setup, a round, results", async ({ page }) => {
  const thanks = page.getByRole('button', { name: 'Thanks' });
  await page.goto('#/');
  await expect(thanks).toBeVisible();

  await page.goto('#/play/quiz');
  await expect(page.getByRole('heading', { name: /Quick quiz/ })).toBeVisible();
  await expect(thanks).toHaveCount(0);
  await page.getByRole('radio', { name: '10 questions' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 10; i++) {
    await page
      .locator('[data-progress]')
      .getByText(`${i + 1} / 10`)
      .waitFor();
    await expect(thanks).toHaveCount(0);
    const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
    await page.locator(`[data-choice][data-word-id="${target}"]`).click();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(thanks).toHaveCount(0);
});
