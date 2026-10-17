import { daysAgo, importProgress, seedFile, seedRound } from './seed.ts';
import { expect, test, type Page } from './test.ts';

/**
 * Tap targets (SPEC §8.3, ROADMAP M9): on the phone, everything that can be tapped is at least
 * 44×44 px. A radio or checkbox drawn as a pill or a row is measured by its label, which is what
 * the finger hits.
 */

const MIN = 44;

/** Every visible control smaller than MIN, as "what it is: width×height" (page code as a string). */
const SMALL_TARGETS = `(() => {
  const controls = document.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex="0"]',
  );
  const small = [];
  for (const control of controls) {
    const target = control.matches('input') ? (control.closest('label') ?? control) : control;
    const box = target.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || getComputedStyle(target).visibility === 'hidden') {
      continue;
    }
    if (box.width < ${MIN} - 0.5 || box.height < ${MIN} - 0.5) {
      const name = (control.getAttribute('aria-label') ?? target.textContent ?? '').trim().slice(0, 40);
      small.push(control.tagName.toLowerCase() + ' "' + name + '": ' + Math.round(box.width) + '×' + Math.round(box.height));
    }
  }
  return small;
})()`;

/** Wednesday 14 October 2026, noon (local time). */
const NOW = new Date(2026, 9, 14, 12, 0);

async function seedProgress(page: Page): Promise<void> {
  await page.clock.setFixedTime(NOW);
  const answers = ['sensei', 'isha', 'kaishain', 'gakusei'].flatMap((wordId) =>
    Array.from({ length: 5 }, (_, i) => ({ wordId, skill: 'meaning' as const, correct: i > 0 })),
  );
  await importProgress(
    page,
    seedFile(seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 9), answers })),
  );
}

async function groupOneOnly(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: /Verbs · Group 1/ }).check();
}

const start = (page: Page) => page.getByRole('button', { name: 'Start' }).tap();

const SCREENS: { name: string; hash: string; steps?(page: Page): Promise<void> }[] = [
  {
    name: 'Today with progress and the export reminder',
    hash: '#/settings',
    steps: async (page) => {
      await seedProgress(page);
      await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0));
      await page.goto('#/');
      await page.locator('[data-export-banner]').waitFor();
    },
  },
  {
    name: 'the thanks sheet',
    hash: '#/',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Thanks' }).tap();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'Notebook', hash: '#/notebook' },
  {
    name: "a verb's forms",
    hash: '#/notebook/verbs-g2',
    steps: async (page) => {
      await page.locator('[aria-haspopup="dialog"]').first().tap();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'Play', hash: '#/play' },
  { name: 'Quick quiz setup', hash: '#/play/quiz' },
  { name: 'Conjugation drill setup', hash: '#/play/conjugation' },
  {
    name: 'a quiz question',
    hash: '#/play/quiz',
    steps: async (page) => {
      await start(page);
      await page.locator('[data-quiz-prompt]').waitFor();
    },
  },
  {
    name: 'a sorter answer with its rule',
    hash: '#/play/sorter',
    steps: async (page) => {
      await groupOneOnly(page);
      await start(page);
      await page.getByRole('button', { name: 'Group 2', exact: true }).tap();
      await page.locator('[data-explanation]').waitFor();
    },
  },
  {
    name: 'a kana question with its hint',
    hash: '#/play/kana',
    steps: async (page) => {
      await start(page);
      await page.getByRole('button', { name: 'Hint' }).tap();
    },
  },
  {
    name: 'Results',
    hash: '#/play/quiz',
    steps: async (page) => {
      await page.getByRole('radio', { name: '10 questions' }).check();
      await start(page);
      for (let i = 0; i < 10; i++) {
        await page
          .locator('[data-progress]')
          .getByText(`${i + 1} / 10`)
          .waitFor();
        await page.locator('[data-choice]').first().tap();
        const next = page.getByRole('button', { name: 'Continue' });
        if (await next.isVisible()) await next.tap();
      }
      await page.getByRole('heading', { name: 'Results' }).waitFor();
    },
  },
  {
    name: 'Stats with progress',
    hash: '#/settings',
    steps: async (page) => {
      await seedProgress(page);
      await page.goto('#/stats');
    },
  },
  { name: 'Settings', hash: '#/settings' },
  { name: 'a page that does not exist', hash: '#/nowhere' },
];

for (const screen of SCREENS) {
  test(`every target is ${MIN} px: ${screen.name}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'tap targets are measured on the phone');
    await page.goto(screen.hash);
    await page.locator('main h1').first().waitFor();
    await screen.steps?.(page);
    expect(await page.evaluate<string[]>(SMALL_TARGETS)).toEqual([]);
  });
}
