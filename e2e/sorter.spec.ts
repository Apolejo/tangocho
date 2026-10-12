import { expect, test, type Page } from '@playwright/test';

/**
 * Verb group sorter (SPEC §9.2): one verb of each group plus 帰る, and the exception
 * explanation. Desktop answers with keys 1–3 and Enter, mobile with taps. Each round uses one
 * group's deck, so the right answer is known without reading the data.
 */

const RULES = {
  g1: "doesn't end in -iru/-eru → group 1",
  exception: "exception: looks like group 2, but it's group 1",
  g2: 'ends in -iru/-eru → group 2',
  g3: 'する, 来る and noun + する → group 3',
};

const progress = (page: Page) => page.locator('[data-progress]');
const status = (page: Page) => page.getByRole('status');
const explanation = (page: Page) => page.locator('[data-explanation]');
const prompt = (page: Page) => page.locator('[data-sorter-prompt]');
const groupButton = (page: Page, group: number) => page.locator(`[data-group-choice="${group}"]`);

async function openSetup(page: Page): Promise<void> {
  await page.goto('#/play');
  await page.getByRole('link', { name: /Verb group sorter/ }).click();
  await expect(page.getByRole('heading', { name: /Verb group sorter/ })).toBeVisible();
}

async function onlyDeck(page: Page, name: string): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: new RegExp(name) }).check();
}

/** Answers a group: its digit key on desktop, a tap on its button on mobile. */
async function answer(page: Page, isMobile: boolean, group: number): Promise<void> {
  const button = page.getByRole('button', { name: `Group ${group}`, exact: true });
  await expect(button).toBeEnabled();
  if (isMobile) await button.tap();
  else await page.keyboard.press(String(group));
}

/** Continue without waiting: Enter on the focused button, or a tap on it. */
async function moveOn(page: Page, isMobile: boolean): Promise<void> {
  const button = page.getByRole('button', { name: 'Continue' });
  if (isMobile) {
    await button.tap();
  } else {
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
  }
}

/** The app's IndexedDB log, summarized (a string, so it runs in the page). */
const SUMMARIZE_EVENTS = `new Promise((resolve, reject) => {
  const req = indexedDB.open('tangocho');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('events').objectStore('events').getAll();
    all.onsuccess = () => {
      db.close();
      const answers = all.result.filter((e) => e.type === 'answer');
      resolve({
        answers: answers.length,
        sorterGroupAnswers: answers.filter((e) => e.game === 'sorter' && e.skill === 'group').length,
        rounds: all.result.filter((e) => e.type === 'round' && e.game === 'sorter').length,
      });
    };
    all.onerror = () => reject(all.error);
  };
})`;

test('setup counts only the verbs, and a deck without verbs blocks Start', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByText('21 words in this selection')).toBeVisible();
  await onlyDeck(page, 'Occupations');
  await expect(page.getByText('0 words in this selection')).toBeVisible();
  await expect(page.getByText('These decks have no words for this game yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled();
});

for (const { group, count, rule } of [
  { group: 2, count: 5, rule: RULES.g2 },
  { group: 3, count: 3, rule: RULES.g3 },
]) {
  test(`group ${group}: the rule after a right and a wrong answer`, async ({ page, isMobile }) => {
    await openSetup(page);
    await onlyDeck(page, `Verbs · Group ${group}`);
    await expect(page.getByText(`${count} words in this selection`)).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();

    // right: ◯ with the rule, the verb in Japanese, and the round moves on by itself
    await expect(progress(page)).toContainText(`1 / ${count}`);
    await expect(prompt(page).locator('[lang="ja"]')).toHaveCount(1);
    await answer(page, isMobile, group);
    await expect(status(page)).toContainText('Correct!');
    await expect(explanation(page)).toContainText(rule);
    await expect(explanation(page).locator('[lang="ja"]').first()).toBeVisible();
    await expect(progress(page)).toContainText(`2 / ${count}`);

    // wrong: ✕, the answer and the rule stay until Continue
    const wrong = group === 2 ? 1 : 2;
    await answer(page, isMobile, wrong);
    await expect(status(page)).toContainText(`Not quite. Answer: Group ${group}`);
    await expect(explanation(page)).toContainText(rule);
    await expect(groupButton(page, wrong)).toHaveAttribute('data-state', 'wrong');
    await expect(groupButton(page, group)).toHaveAttribute('data-state', 'correct');
    await moveOn(page, isMobile);

    for (let i = 3; i <= count; i++) {
      await expect(progress(page)).toContainText(`${i} / ${count}`);
      await answer(page, isMobile, group);
      await expect(status(page)).toContainText('Correct!');
      await moveOn(page, isMobile);
    }

    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByText(`${count - 1} of ${count} correct`)).toBeVisible();
  });
}

test('group 1, and the exception for 帰る', async ({ page, isMobile }) => {
  await openSetup(page);
  await onlyDeck(page, 'Verbs · Group 1');
  await page.getByRole('radio', { name: '20 questions' }).check();
  await page.getByRole('radio', { name: 'Off', exact: true }).check();
  await expect(page.getByText('13 words in this selection')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();

  // a round of 20 over the 13 group 1 fixture verbs asks every one of them, 帰る included
  const asked: string[] = [];
  for (let i = 1; i <= 13; i++) {
    await expect(progress(page)).toContainText(`${i} / 13`);
    const id = (await prompt(page).getAttribute('data-word-id')) ?? '';
    asked.push(id);
    await expect(page.locator('main rt')).toHaveCount(0);

    if (id === 'kaeru') {
      // shown in ます form; the rule quotes the dictionary form with its reading
      await expect(prompt(page)).toHaveText('帰ります');
      await answer(page, isMobile, 2);
      await expect(status(page)).toContainText('Not quite. Answer: Group 1');
      await expect(explanation(page).locator('[lang="ja"]').first()).toHaveText('帰る（かえる）');
      await expect(explanation(page)).toContainText(RULES.exception);
    } else if (id === 'kaku') {
      await expect(prompt(page)).toHaveText('書きます');
      await answer(page, isMobile, 3);
      await expect(status(page)).toContainText('Not quite. Answer: Group 1');
      await expect(explanation(page)).toContainText(`書く（かく） — ${RULES.g1}`);
    } else {
      await answer(page, isMobile, 1);
      await expect(status(page)).toContainText('Correct!');
    }
    await moveOn(page, isMobile);
  }
  expect(asked).toContain('kaeru');
  expect(asked).toContain('kaku');

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('11 of 13 correct · 85%')).toBeVisible();
  await expect
    .poll(() => page.evaluate(SUMMARIZE_EVENTS))
    .toEqual({ answers: 13, sorterGroupAnswers: 13, rounds: 1 });
});
