import { AxeBuilder } from '@axe-core/playwright';
import { daysAgo, importProgress, seedFile, seedRound, type SeedAnswer } from './seed.ts';
import { expect, test, type Page } from './test.ts';

/**
 * Accessibility (SPEC §13, ROADMAP M9): axe's WCAG A and AA rules on every screen, in the paper
 * notebook and the night notebook, contrast included. Desktop only; the phone's tap targets are
 * in targets.spec.ts. Marks are shown finished (reduced motion), so no half-pressed stamp is
 * measured.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * The paper grain is a pseudo-element over the whole page (base.css); without ignorePseudo, axe
 * gives up on every text's contrast instead of measuring it. (`checks` isn't in axe's typed run
 * options, but axe reads it.)
 */
const RUN = {
  checks: { 'color-contrast': { options: { ignorePseudo: true } } },
} as Parameters<AxeBuilder['options']>[0];

/**
 * Every violation, and every contrast axe couldn't decide, as one line each. Left out: the stamps,
 * drawn as decorative SVG (aria-hidden; the 済 in a hanko is part of the seal), and text made only
 * of a symbol like → or ✕, which axe declines to judge (its colors are checked in tokens.test.ts).
 */
async function audit(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .options(RUN)
    .exclude('svg[aria-hidden="true"]')
    .analyze();
  const lines = (kind: string, found: typeof results.violations) =>
    found.flatMap((rule) =>
      rule.nodes.map((node) => `${kind} ${rule.id}: ${node.target.join(' ')} — ${node.html}`),
    );
  const undecided = results.incomplete
    .filter((rule) => rule.id === 'color-contrast')
    .map((rule) => ({
      ...rule,
      nodes: rule.nodes.filter(
        (node) =>
          !node.any.some(
            (check) => (check.data as { messageKey?: string })?.messageKey === 'nonBmp',
          ),
      ),
    }));
  return [...lines('violation', results.violations), ...lines('undecided', undecided)];
}

/** Wednesday 14 October 2026, noon (local time). */
const NOW = new Date(2026, 9, 14, 12, 0);
const WORDS = ['sensei', 'isha', 'kaishain', 'gakusei', 'kangoshi', 'keisatsukan', 'enjinia'];

/** A few days of rounds, one of them perfect, so Today and Stats have something to show. */
async function seedProgress(page: Page): Promise<void> {
  await page.clock.setFixedTime(NOW);
  const answers = (n: number, missed: boolean): SeedAnswer[] =>
    Array.from({ length: n }, (_, i) => ({
      wordId: WORDS[i % WORDS.length] ?? 'sensei',
      skill: 'meaning',
      correct: !missed || i % 4 !== 0,
    }));
  const events = [
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 2, 9), answers: answers(20, false) }),
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 1, 9), answers: answers(20, true) }),
    ...seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 9), answers: answers(20, true) }),
  ];
  await importProgress(page, seedFile(events));
}

async function answerQuizWrong(page: Page): Promise<void> {
  const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
  await page.locator(`[data-choice]:not([data-word-id="${target}"])`).first().click();
}

async function groupOneOnly(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: /Verbs · Group 1/ }).check();
}

const start = (page: Page) => page.getByRole('button', { name: 'Start' }).click();

const SCREENS: { name: string; hash: string; steps?(page: Page): Promise<void> }[] = [
  { name: 'Today', hash: '#/' },
  {
    name: 'Today with progress',
    hash: '#/',
    steps: async (page) => {
      await seedProgress(page);
      await page.goto('#/');
    },
  },
  {
    name: 'the thanks sheet',
    hash: '#/',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Thanks' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'Notebook', hash: '#/notebook' },
  {
    name: "a verb's forms",
    hash: '#/notebook/verbs-g2',
    steps: async (page) => {
      await page.locator('[aria-haspopup="dialog"]').first().click();
      await page.getByRole('dialog').waitFor();
    },
  },
  { name: 'Play', hash: '#/play' },
  { name: 'Quick quiz setup', hash: '#/play/quiz' },
  { name: 'Verb group sorter setup', hash: '#/play/sorter' },
  { name: 'Kana typing setup', hash: '#/play/kana' },
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
    name: 'a wrong quiz answer',
    hash: '#/play/quiz',
    steps: async (page) => {
      await start(page);
      await answerQuizWrong(page);
      await page.getByRole('button', { name: 'Continue' }).waitFor();
    },
  },
  {
    name: "a sorter answer with its rule, and the word's meaning",
    hash: '#/play/sorter',
    steps: async (page) => {
      await groupOneOnly(page);
      await start(page);
      await page.keyboard.press('1');
      await page.locator('[data-explanation]').waitFor();
      await page.locator('[aria-expanded]').first().click();
    },
  },
  {
    name: 'a kana question',
    hash: '#/play/kana',
    steps: async (page) => {
      await start(page);
      await page.locator('[data-kana-prompt]').waitFor();
    },
  },
  {
    name: 'a drill answer with four choices',
    hash: '#/play/conjugation',
    steps: async (page) => {
      await groupOneOnly(page);
      await page.getByRole('radio', { name: 'Four choices' }).check();
      await start(page);
      await page.keyboard.press('1');
      await page.locator('[data-explanation]').waitFor();
    },
  },
  {
    name: 'Results of a perfect round',
    hash: '#/play/quiz',
    steps: async (page) => {
      await page.getByRole('radio', { name: '10 questions' }).check();
      await start(page);
      for (let i = 0; i < 10; i++) {
        await page
          .locator('[data-progress]')
          .getByText(`${i + 1} / 10`)
          .waitFor();
        const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
        await page.locator(`[data-choice][data-word-id="${target}"]`).click();
      }
      await page.getByRole('img', { name: 'Perfect round' }).waitFor();
    },
  },
  {
    name: 'Stats with progress',
    hash: '#/stats',
    steps: async (page) => {
      await seedProgress(page);
      await page.goto('#/stats');
    },
  },
  { name: 'Settings', hash: '#/settings' },
  {
    name: "Settings, reset's second step",
    hash: '#/settings',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Reset progress' }).click();
      await page.getByRole('button', { name: 'Yes, delete it' }).click();
    },
  },
  { name: 'a page that does not exist', hash: '#/nowhere' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    for (const screen of SCREENS) {
      test(screen.name, async ({ page, isMobile }) => {
        test.skip(isMobile, 'axe runs once, on desktop');
        await page.goto(screen.hash);
        await page.locator('main h1').first().waitFor();
        await screen.steps?.(page);
        expect(await audit(page)).toEqual([]);
      });
    }
  });
}
