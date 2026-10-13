/**
 * `npm run shots`: screenshots of every screen at phone and desktop size, light and dark, into
 * shots/ (SPEC §14). Starts the dev server itself. `--only <screen>` limits to one screen,
 * `--full` captures the whole page instead of the viewport.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { WordsFileSchema } from '../src/data/schema.ts';
import { conjugate, isForm, type Conjugated } from '../src/lib/conjugate.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../shots/', import.meta.url));
const WORDS_DIR = fileURLToPath(new URL('../data/words/', import.meta.url));

/** The words the dev server shows, for knowing a conjugation question's answer. */
const WORDS = readdirSync(WORDS_DIR)
  .filter((file) => file.endsWith('.json'))
  .flatMap((file) =>
    WordsFileSchema.parse(JSON.parse(readFileSync(join(WORDS_DIR, file), 'utf8'))),
  );

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

/** Starts a kana typing round in a mode; recall over the katakana deck. */
async function startKana(page: Page, mode: 'Reading' | 'Recall'): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(`^${mode}:`) }).check();
  if (mode === 'Recall') {
    await page.getByRole('checkbox', { name: /All words/ }).uncheck();
    await page.getByRole('checkbox', { name: /Katakana words/ }).check();
  }
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('[data-kana-prompt]').waitFor();
}

/** Types the current word's id, which is the romaji of its reading (minus any gloss), with any data. */
async function typeKanaId(page: Page): Promise<void> {
  const id = (await page.locator('[data-kana-prompt]').getAttribute('data-word-id')) ?? '';
  await page.keyboard.type(id.split('-')[0] ?? '');
}

/** Starts a conjugation round over group 1 verbs, typed or with four choices. */
async function startConjugation(page: Page, input: 'Typing' | 'Four choices'): Promise<void> {
  await sorterGroup1(page);
  await page.getByRole('radio', { name: input }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('[data-conj-prompt]').waitFor();
}

/** The current conjugation question's answer, from the engine (any data). */
async function conjugationAnswer(page: Page): Promise<Conjugated> {
  const prompt = page.locator('[data-conj-prompt]');
  const id = await prompt.getAttribute('data-word-id');
  const form = (await prompt.getAttribute('data-form')) ?? undefined;
  const word = WORDS.find((w) => w.id === id);
  const answer = word !== undefined && isForm(form) ? conjugate(word, form) : undefined;
  if (answer === undefined) throw new Error(`no answer for ${id} ${form}`);
  return answer;
}

/** Add a line here when a screen appears. `steps` clicks through to screens without a URL. */
const SCREENS: {
  name: string;
  hash: string;
  steps?: (page: Page) => Promise<void>;
  /** Open word reports GitHub answers with (none unless given), so screens don't depend on it. */
  reports?: number;
}[] = [
  { name: 'notebook', hash: '#/notebook' },
  { name: 'notebook-reports', hash: '#/notebook', reports: 2 },
  { name: 'notebook-verbs-g2', hash: '#/notebook/verbs-g2' },
  {
    name: 'notebook-verb-forms',
    hash: '#/notebook/verbs-g1',
    steps: async (page) => {
      await page.locator('[data-show-forms]').nth(3).click();
      await page.locator('dialog[open]').waitFor();
    },
  },
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
  { name: 'kana-setup', hash: '#/play/kana' },
  {
    name: 'kana-question',
    hash: '#/play/kana',
    steps: async (page) => {
      await startKana(page, 'Reading');
      await typeKanaId(page);
    },
  },
  {
    name: 'kana-correct',
    hash: '#/play/kana',
    steps: async (page) => {
      await startKana(page, 'Reading');
      await typeKanaId(page);
      await page.keyboard.press('Enter');
      await page.locator('input[data-state]').waitFor();
    },
  },
  {
    name: 'kana-hint',
    hash: '#/play/kana',
    steps: async (page) => {
      await startKana(page, 'Reading');
      await page.getByRole('button', { name: 'Hint' }).click();
      await page.locator('[data-hint]').waitFor();
    },
  },
  {
    name: 'kana-wrong',
    hash: '#/play/kana',
    steps: async (page) => {
      await startKana(page, 'Reading');
      await page.keyboard.type('tanaka');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Continue' }).waitFor();
    },
  },
  {
    name: 'kana-recall',
    hash: '#/play/kana',
    steps: async (page) => {
      await startKana(page, 'Recall');
      await typeKanaId(page);
      await page.keyboard.press('Enter');
      await page.locator('[data-kana-reveal]').waitFor();
    },
  },
  { name: 'conjugation-setup', hash: '#/play/conjugation' },
  {
    name: 'conjugation-typing',
    hash: '#/play/conjugation',
    steps: (page) => startConjugation(page, 'Typing'),
  },
  {
    name: 'conjugation-typing-correct',
    hash: '#/play/conjugation',
    steps: async (page) => {
      await startConjugation(page, 'Typing');
      await page.keyboard.insertText((await conjugationAnswer(page)).kana);
      await page.keyboard.press('Enter');
      await page.locator('[data-explanation]').waitFor();
    },
  },
  {
    name: 'conjugation-choices',
    hash: '#/play/conjugation',
    steps: (page) => startConjugation(page, 'Four choices'),
  },
  {
    name: 'conjugation-choices-wrong',
    hash: '#/play/conjugation',
    steps: async (page) => {
      await startConjugation(page, 'Four choices');
      const answer = await conjugationAnswer(page);
      const right = answer.kanji ?? answer.kana;
      await page.locator(`[data-choice]:not([data-option="${right}"])`).first().click();
      await page.getByRole('button', { name: 'Continue' }).waitFor();
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
          await page.route('https://api.github.com/**', (route) =>
            route.fulfill({
              json: Array.from({ length: screen.reports ?? 0 }, (_, i) => ({ number: i + 1 })),
              headers: { 'Access-Control-Allow-Origin': '*' },
            }),
          );
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
