import { expect, test, type Page } from './test.ts';

/**
 * Tapping the question's word shows its meaning (SPEC §8.3), in the games whose question isn't
 * about the meaning: the sorter, kana reading and the conjugation drill. Looking is free: full
 * points, never a hint. The quiz and kana recall don't offer it.
 */

const MEANING: Record<string, string> = {
  taberu: 'to eat',
  miru: 'to see, to watch',
  okiru: 'to get up, to wake up',
  neru: 'to sleep, to go to bed',
  'kiru-wear': 'to wear, to put on',
  suru: 'to do',
  kuru: 'to come',
  'benkyou-suru': 'to study',
  sensei: 'teacher',
  isha: 'doctor',
  kaishain: 'office worker, company employee',
  gakusei: 'student',
  kangoshi: 'nurse',
  keisatsukan: 'police officer',
};

const peek = (page: Page) => page.locator('[data-meaning-peek]');
const bubble = (page: Page) => page.locator('[data-meaning-bubble]');
const status = (page: Page) => page.getByRole('status');

async function setup(page: Page, game: RegExp, deck: string): Promise<void> {
  await page.goto('#/play');
  await page.getByRole('link', { name: game }).click();
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: new RegExp(deck) }).check();
}

async function tapWord(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await peek(page).tap();
  else await peek(page).click();
}

/** The bubble shows the meaning, whole and on screen. */
async function expectMeaning(page: Page, id: string): Promise<void> {
  await expect(bubble(page)).toHaveText(MEANING[id] ?? '');
  await expect(peek(page)).toHaveAttribute('aria-expanded', 'true');
  const box = await bubble(page).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box !== null && box.x >= 0 && box.x + box.width <= width).toBe(true);
}

test('sorter: the verb’s meaning beside it, closed by the next tap, and full points', async ({
  page,
  isMobile,
}) => {
  await setup(page, /Verb group sorter/, 'Verbs · Group 2');
  await page.getByRole('button', { name: 'Start' }).click();
  const id = (await page.locator('[data-sorter-prompt]').getAttribute('data-word-id')) ?? '';

  await expect(bubble(page)).toHaveCount(0);
  await tapWord(page, isMobile);
  await expectMeaning(page, id);
  if (!isMobile) await expect(bubble(page)).toHaveAttribute('data-placement', 'side');
  // a tap anywhere else closes it
  if (isMobile) await page.locator('[data-progress]').tap();
  else await page.locator('[data-progress]').click();
  await expect(bubble(page)).toHaveCount(0);

  // by keyboard: the word is a button; Enter opens it, Esc closes it
  if (!isMobile) {
    await peek(page).focus();
    await page.keyboard.press('Enter');
    await expectMeaning(page, id);
    await page.keyboard.press('Escape');
    await expect(bubble(page)).toHaveCount(0);
    await tapWord(page, isMobile);
    await expectMeaning(page, id);
  }

  // looking is free: a right answer still scores 100
  const group2 = page.getByRole('button', { name: 'Group 2', exact: true });
  if (isMobile) await group2.tap();
  else await page.keyboard.press('2');
  await expect(status(page)).toContainText('Correct!');
  await expect(page.locator('[data-score]')).toHaveText('100');
});

test('conjugation drill: the meaning while typing, and the field keeps its focus', async ({
  page,
  isMobile,
}) => {
  await setup(page, /Conjugation drill/, 'Verbs · Group 3');
  await page.getByRole('radio', { name: 'Typing' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  const id = (await page.locator('[data-conj-prompt]').getAttribute('data-word-id')) ?? '';
  const field = page.getByRole('textbox', { name: 'Your answer' });

  if (!isMobile) await expect(field).toBeFocused();
  await tapWord(page, isMobile);
  await expectMeaning(page, id);
  if (!isMobile) await expect(field).toBeFocused();
  // never over the form to produce
  const bubbleBox = await bubble(page).boundingBox();
  const targetBox = await page.locator('[data-target]').boundingBox();
  expect(bubbleBox !== null && targetBox !== null).toBe(true);
  if (bubbleBox !== null && targetBox !== null) {
    const apart =
      bubbleBox.y + bubbleBox.height <= targetBox.y ||
      targetBox.y + targetBox.height <= bubbleBox.y ||
      bubbleBox.x + bubbleBox.width <= targetBox.x ||
      targetBox.x + targetBox.width <= bubbleBox.x;
    expect(apart).toBe(true);
  }
});

test('kana reading: the meaning before answering', async ({ page, isMobile }) => {
  await setup(page, /Kana typing/, 'Occupations');
  await page.getByRole('button', { name: 'Start' }).click();
  const id = (await page.locator('[data-kana-prompt]').getAttribute('data-word-id')) ?? '';
  await tapWord(page, isMobile);
  await expectMeaning(page, id);
  // tapping the word again closes it
  await tapWord(page, isMobile);
  await expect(bubble(page)).toHaveCount(0);
});

test('not where the meaning is the question or the prompt', async ({ page }) => {
  // quick quiz, Japanese → meaning
  await page.goto('#/play/quiz');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('[data-quiz-prompt]')).toBeVisible();
  await expect(peek(page)).toHaveCount(0);

  // kana typing, recall: the prompt is a meaning
  await page.goto('#/play/kana');
  await page.getByRole('radio', { name: 'Recall: meaning → kana' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('[data-kana-prompt]')).toBeVisible();
  await expect(peek(page)).toHaveCount(0);
});
