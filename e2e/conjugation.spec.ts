import { expect, test, type Page } from './test.ts';

/**
 * Conjugation drill (SPEC §9.4): both input modes, right and wrong, with the rule after each
 * answer. Desktop types and presses keys; mobile taps. Each round uses one group's deck and one
 * form, so every answer is known from this table, checked by hand.
 */

/** Group 3 in て形, as the fixtures conjugate: the prompt in ます form, the answer, the rule. */
const GROUP3_TE: Record<string, { shown: string; kana: string; kanji?: string; rule: string }> = {
  suru: { shown: 'します', kana: 'して', rule: 'する — group 3: する → して' },
  kuru: {
    shown: '来ます',
    kana: 'きて',
    kanji: '来て',
    rule: '来る（くる） — group 3: くる → きて',
  },
  'benkyou-suru': {
    shown: '勉強します',
    kana: 'べんきょうして',
    kanji: '勉強して',
    rule: '勉強する（べんきょうする） — group 3: する → して',
  },
};

const ROMAJI: Record<string, string> = {
  suru: 'shite',
  kuru: 'kite',
  'benkyou-suru': 'benkyoushite',
};

/** Group 2 in ない形: the options as written. */
const GROUP2_NAI: Record<string, string> = {
  taberu: '食べない',
  miru: '見ない',
  okiru: '起きない',
  neru: '寝ない',
  'kiru-wear': '着ない',
};

const progress = (page: Page) => page.locator('[data-progress]');
const status = (page: Page) => page.getByRole('status');
const explanation = (page: Page) => page.locator('[data-explanation]');
const prompt = (page: Page) => page.locator('[data-conj-prompt]');
const field = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
const formBox = (page: Page, label: string) =>
  page.getByRole('checkbox', { name: label, exact: true });

async function openSetup(page: Page): Promise<void> {
  await page.goto('#/play');
  await page.getByRole('link', { name: /Conjugation drill/ }).click();
  await expect(page.getByRole('heading', { name: /Conjugation drill/ })).toBeVisible();
}

async function onlyDeck(page: Page, name: string): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: new RegExp(name) }).check();
}

/** Leaves one form selected. */
async function onlyForm(page: Page, label: string): Promise<void> {
  for (const other of [
    '辞書形',
    'ます形',
    'ません',
    'ました',
    'ませんでした',
    'て形',
    'ない形',
    'た形',
  ]) {
    if (other !== label) await formBox(page, other).uncheck();
  }
  await expect(formBox(page, label)).toBeChecked();
}

async function currentId(page: Page, table: Record<string, unknown>): Promise<string> {
  const id = (await prompt(page).getAttribute('data-word-id')) ?? '';
  expect(Object.keys(table)).toContain(id);
  return id;
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
      const answers = all.result.filter((e) => e.type === 'answer' && e.game === 'conjugation');
      resolve({
        answers: answers.length,
        skills: [...new Set(answers.map((e) => e.skill))],
        forms: [...new Set(answers.map((e) => e.form))],
        variants: all.result.filter((e) => e.type === 'round').map((e) => e.variant),
      });
    };
    all.onerror = () => reject(all.error);
  };
})`;

test('setup: every verb, every form, and the input mode that suits the device', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await expect(page.getByText('21 words in this selection')).toBeVisible();
  for (const label of [
    '辞書形',
    'ます形',
    'ません',
    'ました',
    'ませんでした',
    'て形',
    'ない形',
    'た形',
  ]) {
    await expect(formBox(page, label)).toBeChecked();
  }
  await expect(
    page.getByRole('radio', { name: isMobile ? 'Four choices' : 'Typing' }),
  ).toBeChecked();

  // no form left: Start waits for one
  for (const label of [
    '辞書形',
    'ます形',
    'ません',
    'ました',
    'ませんでした',
    'て形',
    'ない形',
    'た形',
  ]) {
    await formBox(page, label).uncheck();
  }
  await expect(page.getByText('Pick at least one form.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled();
  await formBox(page, 'た形').check();
  await expect(page.getByRole('button', { name: 'Start' })).toBeEnabled();

  // a deck without verbs has nothing to drill
  await onlyDeck(page, 'Occupations');
  await expect(page.getByText('0 words in this selection')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled();
});

test('typing: て形 of group 3, in romaji or with the kanji, right and wrong', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await onlyDeck(page, 'Verbs · Group 3');
  await onlyForm(page, 'て形');
  await page.getByRole('radio', { name: 'Typing' }).check();
  await page.getByRole('radio', { name: 'Off', exact: true }).check();
  await page.getByRole('button', { name: 'Start' }).click();

  for (let i = 1; i <= 3; i++) {
    await expect(progress(page)).toContainText(`${i} / 3`);
    const id = await currentId(page, GROUP3_TE);
    const expected = GROUP3_TE[id];
    if (expected === undefined) throw new Error(id);
    // the verb in ます form (furigana off), then the form to produce
    await expect(prompt(page).locator('[lang="ja"]').first()).toHaveText(expected.shown);
    await expect(page.locator('main rt')).toHaveCount(0);
    await expect(prompt(page).locator('[data-target]')).toHaveText('て形');
    await expect(prompt(page)).toHaveAttribute('data-form', 'て');

    if (isMobile) await field(page).tap();
    else await expect(field(page)).toBeFocused();

    if (i === 1) {
      // wrong: ✕, the answer with its reading and the rule, until Continue
      await page.keyboard.type('shitte');
      await expect(field(page)).toHaveValue('しって');
      if (isMobile) await page.getByRole('button', { name: 'Check' }).tap();
      else await page.keyboard.press('Enter');
      const answer =
        expected.kanji === undefined ? expected.kana : `${expected.kanji}（${expected.kana}）`;
      await expect(status(page)).toContainText(`Not quite. Answer: ${answer}`);
      await expect(explanation(page)).toHaveText(expected.rule);
      await expect(field(page)).toHaveAttribute('data-state', 'wrong');
      await moveOn(page, isMobile);
      continue;
    }

    // right: in romaji, or 来て as a Japanese keyboard would commit it
    if (id === 'kuru' && !isMobile) await page.keyboard.insertText('来て');
    else await page.keyboard.type(ROMAJI[id] ?? '');
    if (isMobile) await page.getByRole('button', { name: 'Check' }).tap();
    else await page.keyboard.press('Enter');
    await expect(status(page)).toContainText('Correct!');
    await expect(explanation(page)).toHaveText(expected.rule);
    await expect(field(page)).toHaveAttribute('data-state', 'correct');
    // the rule stays up to be read; the field keeps its focus, and Enter there moves on
    if (isMobile) {
      await page.getByRole('button', { name: 'Continue' }).tap();
    } else {
      await expect(field(page)).toBeFocused();
      await page.keyboard.press('Enter');
    }
  }

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('2 of 3 correct')).toBeVisible();
  await expect
    .poll(() => page.evaluate(SUMMARIZE_EVENTS))
    .toEqual({ answers: 3, skills: ['conjugation'], forms: ['て'], variants: ['typing|て'] });
});

test('four choices: ない形 of group 2, by keys or taps, with the ⚑ on the answer', async ({
  page,
  isMobile,
}) => {
  await openSetup(page);
  await onlyDeck(page, 'Verbs · Group 2');
  await onlyForm(page, 'ない形');
  await page.getByRole('radio', { name: 'Four choices' }).check();
  await page.getByRole('button', { name: 'Start' }).click();

  for (let i = 1; i <= 5; i++) {
    await expect(progress(page)).toContainText(`${i} / 5`);
    const id = await currentId(page, GROUP2_NAI);
    const right = GROUP2_NAI[id] ?? '';
    const options = page.locator('[data-choice]');
    await expect(options).toHaveCount(4);
    const texts = await options.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-option')),
    );
    expect(texts).toContain(right);
    expect(new Set(texts).size).toBe(4);
    // furigana on by default: the options carry their readings
    await expect(options.first().locator('rt').first()).toBeVisible();

    const pick = i === 1 ? texts.findIndex((t) => t !== right) : texts.indexOf(right);
    if (isMobile) await options.nth(pick).tap();
    else await page.keyboard.press(String(pick + 1));

    if (i === 1) {
      await expect(status(page)).toContainText(`Not quite. Answer: ${right}`);
      await expect(explanation(page)).toContainText('group 2: る → ない');
      await expect(options.nth(pick)).toHaveAttribute('data-state', 'wrong');
      await expect(page.locator(`[data-option="${right}"]`)).toHaveAttribute(
        'data-state',
        'correct',
      );
      // the ⚑ reports this word in this form, on the word-report form, filled in
      const flag = page.locator(`[data-report="${id}"]`);
      await expect(flag).toHaveAttribute('data-report-form', 'ない');
      await expect(flag).toHaveAttribute('target', '_blank');
      const url = new URL((await flag.getAttribute('href')) ?? '');
      expect(url.pathname).toBe('/Apolejo/tangocho/issues/new');
      expect(url.searchParams.get('template')).toBe('word-report.yml');
      expect(url.searchParams.get('title')).toContain(`ない形 (${id})`);
      expect(url.searchParams.get('form')).toBe('ない形');
      expect(url.searchParams.get('answer')).toContain(right);
      expect(url.searchParams.get('from')).toBe('Conjugation drill');
      await moveOn(page, isMobile);
    } else {
      await expect(status(page)).toContainText('Correct!');
      await expect(explanation(page)).toContainText('group 2: る → ない');
      await moveOn(page, isMobile);
    }
  }

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('4 of 5 correct')).toBeVisible();
  await expect
    .poll(() => page.evaluate(SUMMARIZE_EVENTS))
    .toEqual({ answers: 5, skills: ['conjugation'], forms: ['ない'], variants: ['choices|ない'] });
});
