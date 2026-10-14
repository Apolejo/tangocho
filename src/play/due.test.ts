import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema } from '../data/schema.ts';
import { quiz } from '../games/quiz/index.ts';
import { sorter } from '../games/sorter/index.ts';
import type { GameId, Skill } from '../games/types.ts';
import { answerEvent } from '../progress/events.ts';
import { replay } from '../progress/srs.ts';
import { continueGame, dueCount } from './due.ts';
import { DEFAULT_SETUP } from './setup.ts';

const all = WordsFileSchema.parse(fixtures);

describe('dueCount', () => {
  const T0 = new Date(2026, 9, 13, 12, 0);
  let n = 0;
  const answer = (wordId: string, skill: Skill, game: GameId) =>
    answerEvent(
      { roundId: 'r', game, wordId, skill, correct: true, hinted: false, ms: 1, device: 'd' },
      `a${n++}`,
      T0,
    );
  // each answered once: in a 10-minute learning step, due from 12:10
  const cards = replay([
    answer('kaku', 'group', 'sorter'),
    answer('taberu', 'group', 'sorter'),
    answer('sensei', 'meaning', 'quiz'),
    answer('sensei', 'recall', 'quiz'),
  ]);
  const later = new Date(2026, 9, 13, 12, 30);

  it("counts the due cards a round with the game's options could ask", () => {
    expect(dueCount(sorter, DEFAULT_SETUP.options, all, cards, later)).toBe(2);
    expect(
      dueCount(quiz, { ...DEFAULT_SETUP.options, direction: 'forward' }, all, cards, later),
    ).toBe(1);
    expect(
      dueCount(quiz, { ...DEFAULT_SETUP.options, direction: 'mixed' }, all, cards, later),
    ).toBe(2);
  });

  it('counts only the words in the pool, and nothing before it is due', () => {
    const verbs1 = all.filter((w) => w.verbGroup === 1);
    expect(dueCount(sorter, DEFAULT_SETUP.options, verbs1, cards, later)).toBe(1);
    expect(dueCount(sorter, DEFAULT_SETUP.options, all, cards, T0)).toBe(0);
  });
});

describe('continueGame (SPEC §7.1)', () => {
  const games = (due: Partial<Record<GameId, number>>, unplayable: GameId[] = []) =>
    (['quiz', 'sorter', 'kana', 'conjugation'] as const).map((id) => ({
      id,
      due: due[id] ?? 0,
      playable: !unplayable.includes(id),
    }));

  it('picks the game with the most due cards, the first one on a tie', () => {
    expect(continueGame(games({ sorter: 3, conjugation: 5 }), 'quiz')).toBe('conjugation');
    expect(continueGame(games({ sorter: 3, kana: 3 }), 'quiz')).toBe('sorter');
  });

  it('skips games that cannot start', () => {
    expect(continueGame(games({ sorter: 3, kana: 1 }, ['sorter']), 'quiz')).toBe('kana');
  });

  it('falls back to the last game played, then to the first that can start', () => {
    expect(continueGame(games({}), 'kana')).toBe('kana');
    expect(continueGame(games({}, ['kana']), 'kana')).toBe('quiz');
    expect(continueGame(games({}), undefined)).toBe('quiz');
    expect(continueGame(games({}, ['quiz', 'sorter', 'kana', 'conjugation']), 'quiz')).toBe(
      undefined,
    );
  });
});
