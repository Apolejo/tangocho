import { expect, test, type Locator, type Page } from './test.ts';

/**
 * A whole round by keyboard alone (SPEC §8.3, ROADMAP M9): from Today to a quiz, its setup, ten
 * questions with misses, Results, Play again and Quit, with Tab, Shift+Tab, arrows, Space, Enter
 * and the digit keys only. After every change of screen or question the focus is somewhere
 * useful, never lost on the page.
 */

test.skip(({ isMobile }) => isMobile, 'keyboard');

/** True when the element has the focus (e2e has no DOM types, hence the cast). */
const focused = (target: Locator) =>
  target.evaluate(
    (el) =>
      (el as unknown as { ownerDocument: { activeElement: unknown } }).ownerDocument
        .activeElement === el,
  );

/** Presses Tab (or Shift+Tab) until the target has the focus. */
async function tabTo(page: Page, target: Locator, key = 'Tab'): Promise<void> {
  for (let i = 0; i < 80; i++) {
    if (await focused(target)) return;
    await page.keyboard.press(key);
  }
  throw new Error(`${key} never reached ${target.toString()}`);
}

const focusIsLost = (page: Page) =>
  page.evaluate<boolean>(
    'document.activeElement === null || document.activeElement === document.body',
  );

async function answer(page: Page, correct: boolean): Promise<void> {
  const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
  const ids: (string | null)[] = [];
  for (const choice of await page.locator('[data-choice]').all()) {
    ids.push(await choice.getAttribute('data-word-id'));
  }
  const index = correct ? ids.indexOf(target) : ids.findIndex((id) => id !== target);
  await page.keyboard.press(String(index + 1));
}

test('a whole quiz round, from Today to Results and back, by keyboard alone', async ({ page }) => {
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: /Today/ })).toBeVisible();

  // Today → the quiz's setup
  await tabTo(page, page.locator('a[data-game="quiz"]'));
  await page.keyboard.press('Enter');
  const setupTitle = page.getByRole('heading', { name: /Quick quiz/ });
  await expect(setupTitle).toBeFocused();

  // a deck with Space, the round size with the arrow keys
  const katakana = page.getByRole('checkbox', { name: /Katakana words/ });
  await tabTo(page, katakana);
  await page.keyboard.press('Space');
  await expect(katakana).toBeChecked();
  const ten = page.getByRole('radio', { name: '10 questions' });
  const twenty = page.getByRole('radio', { name: '20 questions' });
  await tabTo(page, (await ten.isChecked()) ? ten : twenty);
  if (await twenty.isChecked()) await page.keyboard.press('ArrowLeft');
  await expect(ten).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(twenty).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(ten).toBeChecked();

  // Start: the first question's card takes the focus
  await tabTo(page, page.getByRole('button', { name: 'Start' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Question 1 of 10' })).toBeFocused();

  for (let i = 0; i < 10; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i + 1} / 10`);
    expect(await focusIsLost(page)).toBe(false);
    const correct = i !== 2 && i !== 7;
    await answer(page, correct);
    if (!correct) {
      await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
      await page.keyboard.press('Enter');
    }
  }

  // Results take the focus at their heading; Play again starts another round
  await expect(page.getByRole('heading', { name: 'Results' })).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: 'Play again' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Question 1 of 10' })).toBeFocused();

  // Quit is just before the card: back to setup, its heading focused
  await tabTo(page, page.getByRole('button', { name: 'Quit' }), 'Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(setupTitle).toBeFocused();

  // the header reaches every screen, and each new screen takes the focus at its heading
  await tabTo(page, page.getByRole('link', { name: 'Stats' }), 'Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Stats/ })).toBeFocused();
  await expect(page).toHaveTitle('Stats · 単語帳 Tangochō');
});

test('Tab goes from the card to the options, and Space continues after a wrong answer', async ({
  page,
}) => {
  await page.goto('#/play/quiz');
  await page.getByRole('button', { name: 'Start' }).focus();
  await page.keyboard.press('Enter');
  const card = page.getByRole('group', { name: 'Question 1 of 10' });
  await expect(card).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-choice', /.*/);
  // the card is a starting point, not a stop: Shift+Tab goes on to Quit
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Quit' })).toBeFocused();

  await answer(page, false);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('group', { name: 'Question 2 of 10' })).toBeFocused();
});
