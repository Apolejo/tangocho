import { daysAgo, importProgress, seedFile, seedRound, type SeedAnswer } from './seed.ts';
import { expect, test, type Page } from './test.ts';

/**
 * Progress (SPEC §7.1, §7.6, §7.7, §10): Today as home, the streak and the stamp card, the goal
 * from today on, Continue, Stats with Practice these, the furigana default and reset. Progress is
 * seeded through Settings → Import, with the clock fixed so the days are known.
 */

/** Wednesday 14 October 2026, noon (local time). */
const NOW = new Date(2026, 9, 14, 12, 0);
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Fixture words (data/fixtures/words.json). */
const NOUNS = ['sensei', 'isha', 'kaishain', 'gakusei', 'kangoshi', 'keisatsukan', 'enjinia'];
const MORE = ['dezainaa', 'norimono', 'kyou', 'tokidoki', 'sarariiman', 'arubaito', 'konpyuutaa'];
const WORDS = [...NOUNS, ...MORE, 'sumaho', 'koohii', 'pan', 'resutoran', 'hoteru', 'takushii'];

const quizAnswers = (count: number, over: Partial<SeedAnswer> = {}): SeedAnswer[] =>
  WORDS.slice(0, count).map((wordId) => ({ wordId, skill: 'meaning', ...over }));

/** Counts the events in the app's IndexedDB log (a string, so it runs in the page). */
const COUNT_EVENTS = `new Promise((resolve, reject) => {
  const req = indexedDB.open('tangocho');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('events').objectStore('events').getAll();
    all.onsuccess = () => {
      db.close();
      resolve(all.result.length);
    };
    all.onerror = () => reject(all.error);
  };
})`;

async function seed(page: Page, events: Parameters<typeof seedFile>[0]): Promise<void> {
  await page.clock.setFixedTime(NOW);
  const result = await importProgress(page, seedFile(events));
  expect(result).toContain(`Merged: ${events.length} new`);
}

const todayHeading = (page: Page) => page.getByRole('heading', { name: /Today/ });

test('Today is home, and the header reaches every screen', async ({ page }) => {
  await page.goto('');
  await expect(todayHeading(page)).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: /Stats/ })).toBeVisible();
  await nav.getByRole('link', { name: 'Notebook' }).click();
  await expect(page).toHaveURL(/#\/notebook$/);
  await nav.getByRole('link', { name: 'Play' }).click();
  await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();
  await page.getByRole('link', { name: /Tangochō/ }).click();
  await expect(todayHeading(page)).toBeVisible();
});

test('a streak of goal days, and the stamp card with its 花丸', async ({ page }) => {
  await seed(page, [
    // two days ago: 20 answers, none perfect (misses, then hints)
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 2, 9),
      answers: quizAnswers(10, { correct: false }),
    }),
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 2, 10),
      answers: quizAnswers(10, { hinted: true }),
    }),
    // yesterday: a perfect round, and one right but hinted (not perfect)
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 1, 9), answers: quizAnswers(10) }),
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 1, 10),
      answers: quizAnswers(10, { hinted: true }),
    }),
    // today, at 2 a.m. counting for yesterday, and this morning
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 2), answers: quizAnswers(5) }),
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 0, 9),
      answers: quizAnswers(20, { correct: false }),
    }),
  ]);
  await page.goto('#/');
  await expect(page.locator('[data-streak]')).toContainText('3 days');
  await expect(page.locator('[data-answered]')).toContainText('20 of 20 answers');
  await expect(page.getByText('Goal met!')).toBeVisible();

  const goalDays = page.locator('td[data-goal]');
  await expect(goalDays).toHaveCount(3);
  for (const days of [2, 1, 0]) {
    await expect(page.locator(`td[data-day="${dayKey(daysAgo(NOW, days))}"]`)).toHaveAttribute(
      'data-goal',
      'true',
    );
  }
  await expect(page.locator('td[data-perfect]')).toHaveCount(1);
  await expect(page.locator(`td[data-day="${dayKey(daysAgo(NOW, 1))}"]`)).toHaveAttribute(
    'data-perfect',
    'true',
  );
});

test('a new daily goal counts from today on', async ({ page }) => {
  await seed(page, [
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 1), answers: quizAnswers(15) }),
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 9), answers: quizAnswers(12) }),
  ]);
  await page.goto('#/');
  await expect(page.locator('[data-answered]')).toContainText('12 of 20 answers');
  await expect(page.locator('[data-streak]')).toContainText('0 days');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page
    .getByRole('group', { name: 'Daily goal' })
    .getByRole('radio', { name: '10 answers' })
    .check();
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.locator('[data-answered]')).toContainText('12 of 10 answers');
  await expect(page.locator('[data-streak]')).toContainText('1 day');
  // yesterday's 15 answers still fall short of the goal it had
  await expect(page.locator(`td[data-day="${dayKey(daysAgo(NOW, 1))}"]`)).not.toHaveAttribute(
    'data-goal',
  );
});

test('Continue starts the game with the most due cards, and they come up', async ({
  page,
  isMobile,
}) => {
  const due = ['kaku', 'taberu', 'kuru'];
  await seed(
    page,
    seedRound({
      game: 'sorter',
      at: daysAgo(NOW, 1),
      answers: due.map((wordId) => ({ wordId, skill: 'group', correct: false })),
    }),
  );
  await page.goto('#/');
  await expect(page.locator('[data-game="sorter"] [data-due]')).toHaveText('3 due');
  await expect(page.locator('[data-game="quiz"] [data-due]')).toHaveText('Nothing due');

  await page.locator('[data-continue="sorter"]').click();
  await expect(page).toHaveURL(/#\/play\/sorter$/);
  const asked: string[] = [];
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i} / 10`);
    asked.push((await page.locator('[data-sorter-prompt]').getAttribute('data-word-id')) ?? '');
    const group = page.getByRole('button', { name: 'Group 1', exact: true });
    if (isMobile) await group.tap();
    else await page.keyboard.press('1');
    const next = page.getByRole('button', { name: 'Continue' });
    if (isMobile) await next.tap();
    else await next.click();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  for (const id of due) expect(asked).toContain(id);
});

test('Stats: mastery, the weakest words, and Practice these', async ({ page, isMobile }) => {
  const start = 200;
  const mastered = [
    daysAgo(NOW, start),
    daysAgo(NOW, start, 12, 15),
    daysAgo(NOW, start - 3),
    daysAgo(NOW, start - 12),
    daysAgo(NOW, start - 40),
    daysAgo(NOW, start - 120),
  ].flatMap((at) =>
    seedRound({ game: 'quiz', at, answers: [{ wordId: 'kyou', skill: 'meaning' }] }),
  );
  await seed(page, [
    ...mastered,
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 2),
      answers: [
        { wordId: 'sensei', skill: 'meaning', correct: false },
        { wordId: 'isha', skill: 'meaning', correct: false },
        { wordId: 'gakusei', skill: 'meaning' },
      ],
    }),
    ...seedRound({
      game: 'quiz',
      at: daysAgo(NOW, 1),
      answers: [
        { wordId: 'sensei', skill: 'meaning', correct: false },
        { wordId: 'isha', skill: 'meaning' },
        { wordId: 'gakusei', skill: 'meaning' },
      ],
    }),
  ]);
  await page.goto('#/stats');
  await expect(page.locator('[data-deck="all"] [data-mastered]')).toHaveAttribute(
    'data-mastered',
    '1',
  );
  const weakest = page.locator('[data-weakest="quiz"] li');
  await expect(weakest).toHaveCount(2);
  await expect(weakest.nth(0)).toHaveAttribute('data-word-id', 'sensei');
  await expect(weakest.nth(0)).toContainText('2 missed of the last 2');
  await expect(weakest.nth(1)).toHaveAttribute('data-word-id', 'isha');

  // another game has nothing weak yet
  await page.getByRole('radio', { name: 'Verb group sorter' }).check();
  await expect(page.getByText('No misses lately')).toBeVisible();
  await page.getByRole('radio', { name: 'Quick quiz' }).check();

  await page.getByRole('link', { name: 'Practice these' }).click();
  await expect(page).toHaveURL(/#\/play\/quiz$/);
  const asked: string[] = [];
  for (let i = 1; i <= 2; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i} / 2`);
    const target = (await page.locator('[data-quiz-prompt]').getAttribute('data-word-id')) ?? '';
    asked.push(target);
    const right = page.locator(`[data-choice][data-word-id="${target}"]`);
    if (isMobile) await right.tap();
    else await right.click();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  expect(asked.sort()).toEqual(['isha', 'sensei']);
});

test('the furigana default reaches every game, but not the notebook', async ({ page }) => {
  // a game set up before keeps the rest of its setup
  await page.goto('#/play/quiz');
  await page.getByRole('radio', { name: '20 questions' }).check();

  await page.goto('#/settings');
  await page
    .getByRole('group', { name: 'Furigana in games' })
    .getByRole('radio', { name: 'Off' })
    .check();

  for (const game of ['quiz', 'sorter']) {
    await page.goto(`#/play/${game}`);
    await expect(
      page.getByRole('group', { name: 'Furigana' }).getByRole('radio', { name: 'Off' }),
    ).toBeChecked();
  }
  await page.goto('#/play/quiz');
  await expect(page.getByRole('radio', { name: '20 questions' })).toBeChecked();

  await page.goto('#/notebook');
  await expect(page.locator('rt').first()).toBeAttached();
});

test('reset takes two confirmations and empties the log', async ({ page }) => {
  await seed(page, seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 9), answers: quizAnswers(5) }));
  await expect.poll(() => page.evaluate(COUNT_EVENTS)).toBe(6);

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page.getByText('Are you sure? This cannot be undone.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.locator('[data-transfer-status]')).toHaveText('Progress deleted.');
  await expect.poll(() => page.evaluate(COUNT_EVENTS)).toBe(0);

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.locator('[data-answered]')).toContainText('0 of 20 answers');
});

test('Today reminds me to export after a week, until hidden', async ({ page }) => {
  await seed(page, seedRound({ game: 'quiz', at: daysAgo(NOW, 8), answers: quizAnswers(3) }));
  await page.goto('#/');
  const banner = page.locator('[data-export-banner]');
  await expect(banner).toContainText("You haven't exported your progress yet.");
  await banner.getByRole('button', { name: 'Hide' }).click();
  await expect(banner).toHaveCount(0);
  await page.getByRole('link', { name: 'Stats' }).click();
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(todayHeading(page)).toBeVisible();
  await expect(banner).toHaveCount(0);
});
