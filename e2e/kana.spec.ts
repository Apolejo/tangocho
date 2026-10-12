import { expect, test, type Page } from '@playwright/test';

/**
 * Kana typing (SPEC §9.3). Rounds use the Occupations deck of the fixtures: six words with kanji
 * and four in katakana, so every answer is known. Desktop types and presses Enter; mobile taps
 * the field and Check. A Japanese keyboard is simulated by inserting its committed text.
 */

const KANA: Record<string, string> = {
  sensei: 'せんせい',
  isha: 'いしゃ',
  kaishain: 'かいしゃいん',
  gakusei: 'がくせい',
  kangoshi: 'かんごし',
  keisatsukan: 'けいさつかん',
  enjinia: 'エンジニア',
  dezainaa: 'デザイナー',
  sarariiman: 'サラリーマン',
  arubaito: 'アルバイト',
};

const KANJI: Record<string, string> = {
  sensei: '先生',
  isha: '医者',
  kaishain: '会社員',
  gakusei: '学生',
  kangoshi: '看護師',
  keisatsukan: '警察官',
};

/** The English meanings of the words with kanji, shown once a reading is answered. */
const MEANING: Record<string, string> = {
  sensei: 'teacher',
  isha: 'doctor',
  kaishain: 'office worker, company employee',
  gakusei: 'student',
  kangoshi: 'nurse',
  keisatsukan: 'police officer',
};

const ROMAJI: Record<string, string> = {
  sensei: 'sensei',
  isha: 'isha',
  kaishain: 'kaishain',
  gakusei: 'gakusei',
  kangoshi: 'kangoshi',
  keisatsukan: 'keisatsukan',
  enjinia: 'enjinia',
  dezainaa: 'dezainaa',
  sarariiman: 'sarari-man',
  arubaito: 'arubaito',
};

const progress = (page: Page) => page.locator('[data-progress]');
const status = (page: Page) => page.getByRole('status');
const prompt = (page: Page) => page.locator('[data-kana-prompt]');
const field = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
const explanation = (page: Page) => page.locator('[data-explanation]');
const meaning = (page: Page) => page.locator('[data-kana-meaning]');

async function openSetup(page: Page): Promise<void> {
  await page.goto('#/play');
  await page.getByRole('link', { name: /Kana typing/ }).click();
  await expect(page.getByRole('heading', { name: /Kana typing/ })).toBeVisible();
}

async function onlyDeck(page: Page, name: string): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: new RegExp(name) }).check();
}

async function currentId(page: Page): Promise<string> {
  const id = (await prompt(page).getAttribute('data-word-id')) ?? '';
  expect(Object.keys(KANA)).toContain(id);
  return id;
}

/** Types into the field: romaji key by key, or a Japanese keyboard's committed text at once. */
async function write(page: Page, isMobile: boolean, text: string, ime = false): Promise<void> {
  if (isMobile) await field(page).tap();
  else await expect(field(page)).toBeFocused();
  if (ime) await page.keyboard.insertText(text);
  else await page.keyboard.type(text);
}

/** Submits: Enter on desktop, a tap on Check on mobile. */
async function submit(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.getByRole('button', { name: 'Check' }).tap();
  else await page.keyboard.press('Enter');
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

/**
 * Moves on from a right answer that stays up to be read: Enter in the field, which keeps its
 * focus (so a phone keeps its keyboard), or a tap on Continue.
 */
async function moveOnFromField(page: Page, isMobile: boolean): Promise<void> {
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'Continue' }).tap();
  } else {
    await expect(field(page)).toBeFocused();
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
      const answers = all.result.filter((e) => e.type === 'answer' && e.game === 'kana');
      resolve({
        answers: answers.length,
        skills: [...new Set(answers.map((e) => e.skill))],
        hinted: answers.filter((e) => e.hinted).length,
        variants: all.result.filter((e) => e.type === 'round').map((e) => e.variant),
      });
    };
    all.onerror = () => reject(all.error);
  };
})`;

test('setup counts words with kanji for reading and every word for recall', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByRole('radio', { name: 'Reading: kanji → kana' })).toBeChecked();
  await expect(page.getByText('28 words in this selection')).toBeVisible();
  await page.getByRole('radio', { name: 'Recall: meaning → kana' }).check();
  await expect(page.getByText('44 words in this selection')).toBeVisible();
  await onlyDeck(page, 'Occupations');
  await expect(page.getByText('10 words in this selection')).toBeVisible();
  await page.getByRole('radio', { name: 'Reading: kanji → kana' }).check();
  await expect(page.getByText('6 words in this selection')).toBeVisible();
});

test('reading mode: romaji answers, the meaning, a hint, and a wrong answer', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await onlyDeck(page, 'Occupations');
  await page.getByRole('button', { name: 'Start' }).click();

  for (let i = 1; i <= 6; i++) {
    await expect(progress(page)).toContainText(`${i} / 6`);
    const id = await currentId(page);
    // the kanji form, furigana hidden
    await expect(prompt(page).locator('[lang="ja"]')).toHaveText(KANJI[id] ?? '');
    await expect(page.locator('main rt')).toHaveCount(0);
    await expect(meaning(page)).toHaveText(/^\s*$/);

    if (i === 1) {
      // wrong: ✕, the answer, and the reading and meaning shown until Continue
      await write(page, isMobile, 'tanaka');
      await submit(page, isMobile);
      await expect(status(page)).toContainText(`Not quite. Answer: ${KANA[id]}`);
      await expect(field(page)).toHaveAttribute('data-state', 'wrong');
      await expect(field(page)).toHaveValue('たなか');
      await expect(page.locator('main rt').first()).toBeVisible();
      await expect(meaning(page)).toHaveText(MEANING[id] ?? '');
      await moveOn(page, isMobile);
    } else if (i === 2) {
      // a hint shows the first kana; the answer still counts, for half the points
      await page.getByRole('button', { name: 'Hint' }).click();
      await expect(page.locator('[data-hint]')).toHaveText(`Starts with ${KANA[id]?.[0]}`);
      await write(page, isMobile, ROMAJI[id] ?? '');
      await submit(page, isMobile);
      await expect(status(page)).toContainText('Correct!');
      await expect(page.locator('[data-score]')).toHaveText('50');
      await expect(meaning(page)).toHaveText(MEANING[id] ?? '');
      await moveOnFromField(page, isMobile);
    } else {
      await write(page, isMobile, ROMAJI[id] ?? '');
      if (id === 'kaishain' || id === 'keisatsukan') {
        // a trailing n waits while typing, and becomes ん on submit
        await expect(field(page)).toHaveValue(`${KANA[id]?.slice(0, -1)}n`);
      } else {
        await expect(field(page)).toHaveValue(KANA[id] ?? '');
      }
      await submit(page, isMobile);
      await expect(status(page)).toContainText('Correct!');
      await expect(field(page)).toHaveValue(KANA[id] ?? '');
      await expect(field(page)).toHaveAttribute('data-state', 'correct');
      // right too: the meaning shows, and the answer stays up until moved on
      await expect(meaning(page)).toHaveText(MEANING[id] ?? '');
      await moveOnFromField(page, isMobile);
    }
  }

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('5 of 6 correct')).toBeVisible();
  await expect
    .poll(() => page.evaluate(SUMMARIZE_EVENTS))
    .toEqual({ answers: 6, skills: ['reading'], hinted: 1, variants: ['reading'] });
});

test('recall mode: katakana, ー or its vowel, and a Japanese keyboard', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await onlyDeck(page, 'Occupations');
  await page.getByRole('radio', { name: 'Recall: meaning → kana' }).check();
  await page.getByRole('button', { name: 'Start' }).click();

  const asked: string[] = [];
  for (let i = 1; i <= 10; i++) {
    await expect(progress(page)).toContainText(`${i} / 10`);
    const id = await currentId(page);
    asked.push(id);
    // a meaning, no Japanese until answered
    await expect(prompt(page).locator('[lang="ja"]')).toHaveCount(0);

    const kanji = KANJI[id];
    if (kanji !== undefined) {
      // a Japanese keyboard: the exact kanji form counts
      await write(page, isMobile, kanji, true);
      await submit(page, isMobile);
      await expect(status(page)).toContainText('Correct!');
    } else if (id === 'sarariiman') {
      // romaji turns into katakana as typed; the trailing n becomes ン, not ん
      await write(page, isMobile, ROMAJI[id] ?? '');
      await expect(field(page)).toHaveValue('サラリーマn');
      await submit(page, isMobile);
      await expect(field(page)).toHaveValue('サラリーマン');
      await expect(status(page)).toContainText('Correct!');
    } else if (id === 'dezainaa') {
      // the vowel for ー counts, with a note on how it's written
      await write(page, isMobile, ROMAJI[id] ?? '');
      await submit(page, isMobile);
      await expect(status(page)).toContainText('Correct!');
      await expect(explanation(page)).toHaveText("It's written デザイナー.");
    } else {
      await write(page, isMobile, ROMAJI[id] ?? '');
      await expect(field(page)).toHaveValue(KANA[id] ?? '');
      await submit(page, isMobile);
      await expect(status(page)).toContainText('Correct!');
    }
    // the word appears under the meaning
    await expect(page.locator('[data-kana-reveal]')).toContainText(kanji ?? KANA[id] ?? '');
    if (id === 'dezainaa') await moveOnFromField(page, isMobile);
  }
  expect(asked.sort()).toEqual(Object.keys(KANA).sort());

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('10 of 10 correct')).toBeVisible();
  await expect
    .poll(() => page.evaluate(SUMMARIZE_EVENTS))
    .toEqual({ answers: 10, skills: ['recall'], hinted: 0, variants: ['recall'] });
});
