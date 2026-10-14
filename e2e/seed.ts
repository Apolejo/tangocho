import type { Page } from '@playwright/test';

/**
 * Progress for e2e tests and screenshots: export files written the way the app writes them
 * (SPEC §10.1, src/progress/events.ts), brought in through Settings → Import, so nothing reaches
 * into IndexedDB. The shapes are repeated here so the tests stay apart from the app's code.
 */

export type GameId = 'quiz' | 'sorter' | 'kana' | 'conjugation';
export type Skill = 'meaning' | 'recall' | 'reading' | 'group' | 'conjugation';

interface AnswerEvent {
  type: 'answer';
  id: string;
  at: string;
  roundId: string;
  game: GameId;
  wordId: string;
  skill: Skill;
  form?: string;
  correct: boolean;
  hinted: boolean;
  ms: number;
  device: string;
}

interface RoundEvent {
  type: 'round';
  id: string;
  at: string;
  game: GameId;
  deckIds: string[];
  size: number;
  variant: string;
  practice: boolean;
  score: number;
  correct: number;
  total: number;
}

export type ProgressEvent = AnswerEvent | RoundEvent;

export interface SeedAnswer {
  wordId: string;
  skill: Skill;
  correct?: boolean;
  hinted?: boolean;
  form?: string;
}

/** A day `daysAgo` before `now`, at a local hour (noon by default). */
export function daysAgo(now: Date, days: number, hour = 12, minute = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute);
}

let n = 0;

/** A finished round: its answers a few seconds apart, then the round event with the last one. */
export function seedRound({
  game,
  at,
  answers,
  practice = false,
  device = 'seed-device',
}: {
  game: GameId;
  at: Date;
  answers: readonly SeedAnswer[];
  practice?: boolean;
  device?: string;
}): ProgressEvent[] {
  const roundId = `seed-round-${n++}`;
  const events: AnswerEvent[] = answers.map((a, i) => ({
    type: 'answer',
    id: `seed-answer-${n++}`,
    at: new Date(at.getTime() + i * 5000).toISOString(),
    roundId,
    game,
    wordId: a.wordId,
    skill: a.skill,
    ...(a.form !== undefined && { form: a.form }),
    correct: a.correct ?? true,
    hinted: a.hinted ?? false,
    ms: 2000,
    device,
  }));
  const correct = events.filter((e) => e.correct).length;
  const round: RoundEvent = {
    type: 'round',
    id: roundId,
    at: events.at(-1)?.at ?? at.toISOString(),
    game,
    deckIds: ['all'],
    size: 10,
    variant: game === 'quiz' ? 'forward' : '',
    practice,
    score: correct * 100,
    correct,
    total: events.length,
  };
  return [...events, round];
}

/** An export file's text. */
export function seedFile(events: readonly ProgressEvent[], device = 'seed-device'): string {
  return JSON.stringify({
    app: 'tangocho',
    version: 1,
    exportedAt: new Date().toISOString(),
    device,
    events,
  });
}

/** Imports a file through Settings and returns the result line. `settings` is its address. */
export async function importProgress(
  page: Page,
  text: string,
  settings = '#/settings',
): Promise<string> {
  if (!page.url().includes('#/settings')) await page.goto(settings);
  const status = page.locator('[data-transfer-status]');
  const before = Number(await status.getAttribute('data-transfer-status'));
  await page.locator('[data-import]').setInputFiles({
    name: 'tangocho-progress-seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  // a string, so it runs in the page
  await page.waitForFunction(
    `Number(document.querySelector('[data-transfer-status]')?.getAttribute('data-transfer-status')) > ${before}`,
  );
  return (await status.textContent()) ?? '';
}
