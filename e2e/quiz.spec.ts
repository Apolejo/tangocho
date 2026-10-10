import { expect, test, type Page } from '@playwright/test';

/**
 * Quick quiz (SPEC §9.1): right and wrong answers by keyboard on desktop and by tap on mobile,
 * with furigana on and off, in both directions. Also: every answer appends an event, and the
 * personal best survives a reload (ROADMAP M3).
 */

const progress = (page: Page) => page.locator('[data-progress]');

async function openSetup(page: Page): Promise<void> {
  await page.goto('#/play');
  await page.getByRole('link', { name: /Quick quiz/ }).click();
  await expect(page.getByRole('heading', { name: /Quick quiz/ })).toBeVisible();
}

/** Answers the current question right or wrong: digit keys on desktop, a tap on mobile. */
async function answer(
  page: Page,
  isMobile: boolean,
  correct: boolean,
): Promise<{ target: string; index: number }> {
  const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
  const choices = page.locator('[data-choice]');
  await expect(choices).toHaveCount(4);
  const ids: (string | null)[] = [];
  for (let i = 0; i < 4; i++) ids.push(await choices.nth(i).getAttribute('data-word-id'));
  const index = correct ? ids.indexOf(target) : ids.findIndex((id) => id !== target);
  expect(target).not.toBeNull();
  expect(index).toBeGreaterThanOrEqual(0);
  if (isMobile) await choices.nth(index).tap();
  else await page.keyboard.press(String(index + 1));
  return { target: target ?? '', index };
}

/** After a wrong answer: Enter on the focused Continue button, or a tap on it. */
async function continueAfterWrong(page: Page, isMobile: boolean): Promise<void> {
  const button = page.getByRole('button', { name: 'Continue' });
  if (isMobile) {
    await button.tap();
  } else {
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
  }
}

async function expectWrongFeedback(page: Page, given: { target: string; index: number }) {
  await expect(page.getByRole('status')).toContainText('Not quite.');
  await expect(page.locator('[data-choice]').nth(given.index)).toHaveAttribute(
    'data-state',
    'wrong',
  );
  await expect(page.locator(`[data-choice][data-word-id="${given.target}"]`)).toHaveAttribute(
    'data-state',
    'correct',
  );
}

/** Counts the events in the app's IndexedDB log (a string, so it runs in the page). */
const COUNT_EVENTS = `new Promise((resolve, reject) => {
  const req = indexedDB.open('tangocho');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('events').objectStore('events').getAll();
    all.onsuccess = () => {
      db.close();
      resolve({
        answers: all.result.filter((e) => e.type === 'answer').length,
        rounds: all.result.filter((e) => e.type === 'round').length,
      });
    };
    all.onerror = () => reject(all.error);
  };
})`;

test('forward with furigana: a right and a wrong answer', async ({ page, isMobile }) => {
  await openSetup(page);
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: /Verbs · Group 2/ }).check();
  await expect(page.getByText('5 words in this selection')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Japanese → meaning' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'On', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Start' }).click();

  // every group 2 fixture verb has kanji, so the prompt carries furigana
  await expect(progress(page)).toContainText('1 / 5');
  await expect(page.locator('[data-quiz-prompt] rt').first()).toBeVisible();
  await answer(page, isMobile, true);
  await expect(page.getByRole('status')).toHaveText('Correct!');
  await expect(progress(page)).toContainText('2 / 5');
  await expect(page.locator('[data-score]')).toHaveText('100');

  await expect(page.locator('[data-quiz-prompt] rt').first()).toBeVisible();
  const wrong = await answer(page, isMobile, false);
  await expectWrongFeedback(page, wrong);
  await continueAfterWrong(page, isMobile);
  await expect(progress(page)).toContainText('3 / 5');
});

test('reverse without furigana: a right and a wrong answer', async ({ page, isMobile }) => {
  await openSetup(page);
  await page.getByRole('radio', { name: 'Meaning → Japanese' }).check();
  await page.getByRole('radio', { name: 'Off', exact: true }).check();
  await page.getByRole('button', { name: 'Start' }).click();

  await expect(progress(page)).toContainText('1 / 10');
  // the prompt is a meaning; the options are Japanese, with no furigana
  await expect(page.locator('[data-quiz-prompt] [lang="ja"]')).toHaveCount(0);
  await expect(page.locator('[data-choice] [lang="ja"]')).toHaveCount(4);
  await expect(page.locator('main rt')).toHaveCount(0);
  await answer(page, isMobile, true);
  await expect(page.getByRole('status')).toHaveText('Correct!');
  await expect(progress(page)).toContainText('2 / 10');

  await expect(page.locator('main rt')).toHaveCount(0);
  const wrong = await answer(page, isMobile, false);
  await expectWrongFeedback(page, wrong);
  await continueAfterWrong(page, isMobile);
  await expect(progress(page)).toContainText('3 / 10');
});

test('a full round: results, the event log, and a best that survives a reload', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await page.getByRole('radio', { name: 'Mixed' }).check();
  await expect(page.locator('[data-best]')).toHaveText('No personal best yet.');
  await page.getByRole('button', { name: 'Start' }).click();

  for (let i = 0; i < 10; i++) {
    await expect(progress(page)).toContainText(`${i + 1} / 10`);
    const correct = i !== 3;
    const given = await answer(page, isMobile, correct);
    if (!correct) {
      await expectWrongFeedback(page, given);
      await continueAfterWrong(page, isMobile);
    }
  }

  // 100 + 110 + 120, a miss, then 100 + 110 + … + 150
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.locator('[data-score]')).toHaveText('1,080');
  await expect(page.getByText('9 of 10 correct · 90%')).toBeVisible();
  await expect(page.getByRole('img', { name: 'New record' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Practice these' })).toBeVisible();

  // every answer appended an event, plus one for the round
  await expect.poll(() => page.evaluate(COUNT_EVENTS)).toEqual({ answers: 10, rounds: 1 });

  await page.reload();
  await expect(page.getByRole('heading', { name: /Quick quiz/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mixed' })).toBeChecked();
  await expect(page.locator('[data-best]')).toHaveText('Personal best: 1,080');

  // the best is per direction
  await page.getByRole('radio', { name: 'Japanese → meaning' }).check();
  await expect(page.locator('[data-best]')).toHaveText('No personal best yet.');
});
