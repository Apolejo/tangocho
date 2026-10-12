/**
 * `npm run shots`: screenshots of every screen at phone and desktop size, light and dark, into
 * shots/ (SPEC §14). Starts the dev server itself. `--only <screen>` limits to one screen,
 * `--full` captures the whole page instead of the viewport.
 */
import { mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../shots/', import.meta.url));

/** Answers the current quiz question right or wrong by keyboard (the e2e trick: matching word ids). */
async function answerQuiz(page: Page, correct: boolean): Promise<void> {
  const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
  const choices = page.locator('[data-choice]');
  const ids: (string | null)[] = [];
  for (let i = 0; i < (await choices.count()); i++) {
    ids.push(await choices.nth(i).getAttribute('data-word-id'));
  }
  const index = correct ? ids.indexOf(target) : ids.findIndex((id) => id !== target);
  await page.keyboard.press(String(index + 1));
}

async function startQuiz(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('[data-quiz-prompt]').waitFor();
}

/** A round of 10 with two misses, ending on the results screen. */
async function playQuizRound(page: Page): Promise<void> {
  await startQuiz(page);
  for (let i = 0; i < 10; i++) {
    await page
      .locator('[data-progress]')
      .getByText(`${i + 1} / 10`)
      .waitFor();
    const correct = i !== 2 && i !== 6;
    await answerQuiz(page, correct);
    if (!correct) await page.keyboard.press('Enter');
  }
  await page.getByRole('heading', { name: 'Results' }).waitFor();
}

/** Sorter setup over group 1 only, so 1 is always right and 2 always wrong with any data. */
async function sorterGroup1(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /All words/ }).uncheck();
  await page.getByRole('checkbox', { name: /Verbs · Group 1/ }).check();
}

async function startSorter(page: Page): Promise<void> {
  await sorterGroup1(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('[data-sorter-prompt]').waitFor();
}

/** Answers the current sorter question, then waits for the rule. */
async function answerSorter(page: Page, group: 1 | 2): Promise<void> {
  await page.keyboard.press(String(group));
  await page.locator('[data-explanation]').waitFor();
}

/** Add a line here when a screen appears. `steps` clicks through to screens without a URL. */
const SCREENS: { name: string; hash: string; steps?: (page: Page) => Promise<void> }[] = [
  { name: 'notebook', hash: '#/notebook' },
  { name: 'notebook-verbs-g2', hash: '#/notebook/verbs-g2' },
  { name: 'play', hash: '#/play' },
  { name: 'quiz-setup', hash: '#/play/quiz' },
  { name: 'quiz-question', hash: '#/play/quiz', steps: startQuiz },
  {
    name: 'quiz-correct',
    hash: '#/play/quiz',
    steps: async (page) => {
      await startQuiz(page);
      await answerQuiz(page, true);
    },
  },
  {
    name: 'quiz-wrong',
    hash: '#/play/quiz',
    steps: async (page) => {
      await startQuiz(page);
      await answerQuiz(page, false);
      await page.getByRole('button', { name: 'Continue' }).waitFor();
    },
  },
  { name: 'quiz-results', hash: '#/play/quiz', steps: playQuizRound },
  { name: 'sorter-setup', hash: '#/play/sorter', steps: sorterGroup1 },
  { name: 'sorter-question', hash: '#/play/sorter', steps: startSorter },
  {
    name: 'sorter-correct',
    hash: '#/play/sorter',
    steps: async (page) => {
      await startSorter(page);
      await answerSorter(page, 1);
    },
  },
  {
    name: 'sorter-wrong',
    hash: '#/play/sorter',
    steps: async (page) => {
      await startSorter(page);
      await answerSorter(page, 2);
    },
  },
];

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
];

const SCHEMES = ['light', 'dark'] as const;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const only = arg('--only');
  const fullPage = process.argv.includes('--full');
  const screens = SCREENS.filter((s) => only === undefined || s.name === only);
  if (screens.length === 0) throw new Error(`no screen named "${only}"`);

  const server = await createServer({ root: ROOT, logLevel: 'silent' });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error('dev server has no local URL');
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const screen of screens) {
      for (const viewport of VIEWPORTS) {
        for (const colorScheme of SCHEMES) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.deviceScaleFactor,
            colorScheme,
            locale: 'en-US',
          });
          const page = await context.newPage();
          await page.goto(url + screen.hash, { waitUntil: 'networkidle' });
          await screen.steps?.(page);
          await page.evaluate('document.fonts.ready');
          const file = `${OUT}${screen.name}-${viewport.name}-${colorScheme}.png`;
          await page.screenshot({ path: file, fullPage });
          console.log(`  ${relative(ROOT, file)}`);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
