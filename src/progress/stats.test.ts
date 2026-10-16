import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema } from '../data/schema.ts';
import { conjugation } from '../games/conjugation/index.ts';
import { kana } from '../games/kana/index.ts';
import { quiz } from '../games/quiz/index.ts';
import type { GameId, Skill } from '../games/types.ts';
import { answerEvent, type AnswerEvent } from './events.ts';
import { RECENT_ANSWERS } from './forms.ts';
import { replay } from './srs.ts';
import { accuracyByForm, accuracyByGroup, weakestCards } from './stats.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = new Map(all.map((w) => [w.id, w]));

let n = 0;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12);
function answer(
  wordId: string,
  skill: Skill,
  correct: boolean,
  { day = n, form, game = 'quiz' }: { day?: number; form?: string; game?: GameId } = {},
): AnswerEvent {
  return answerEvent(
    {
      roundId: 'r',
      game,
      wordId,
      skill,
      ...(form !== undefined && { form }),
      correct,
      hinted: false,
      ms: 900,
      device: 'd',
    },
    `a${n++}`,
    new Date(T0 + day * DAY),
  );
}

describe('accuracy', () => {
  it('splits verb groups between the sorter and the drill', () => {
    const answers = [
      answer('kaku', 'group', true, { game: 'sorter' }),
      answer('kaeru', 'group', false, { game: 'sorter' }),
      answer('taberu', 'group', true, { game: 'sorter' }),
      answer('taberu', 'conjugation', false, { game: 'conjugation', form: 'て' }),
      answer('kuru', 'conjugation', true, { game: 'conjugation', form: 'ない' }),
      answer('taberu', 'meaning', false), // not about the group
      answer('removed-verb', 'group', false, { game: 'sorter' }),
    ];
    expect(accuracyByGroup(answers, byId)).toEqual({
      1: { sorter: { correct: 1, total: 2 }, drill: { correct: 0, total: 0 } },
      2: { sorter: { correct: 1, total: 1 }, drill: { correct: 0, total: 1 } },
      3: { sorter: { correct: 0, total: 0 }, drill: { correct: 1, total: 1 } },
    });
  });

  it('counts the drill per form', () => {
    const answers = [
      answer('kaku', 'conjugation', true, { game: 'conjugation', form: 'て' }),
      answer('taberu', 'conjugation', false, { game: 'conjugation', form: 'て' }),
      answer('kaku', 'conjugation', true, { game: 'conjugation', form: 'ない' }),
      answer('removed-verb', 'conjugation', false, { game: 'conjugation', form: 'ない' }),
    ];
    expect(accuracyByForm(answers, byId)).toEqual(
      new Map([
        ['て', { correct: 1, total: 2 }],
        ['ない', { correct: 1, total: 1 }],
      ]),
    );
  });
});

describe('weakestCards (SPEC §10.5)', () => {
  it('orders cards by weakness, then by lower stability', () => {
    const answers = [
      // two misses
      answer('sensei', 'meaning', false, { day: 0 }),
      answer('sensei', 'meaning', false, { day: 1 }),
      // one miss, then right twice: steadier
      answer('isha', 'meaning', false, { day: 0 }),
      answer('isha', 'meaning', true, { day: 1 }),
      answer('isha', 'meaning', true, { day: 3 }),
      // one miss, answered once: the least stable of the ones with one miss
      answer('gakusei', 'recall', false, { day: 2 }),
      // never missed: not weak
      answer('kaishain', 'meaning', true, { day: 0 }),
    ];
    const weak = weakestCards(replay(answers), quiz, byId);
    expect(weak.map((w) => `${w.card.wordId}|${w.card.skill}`)).toEqual([
      'sensei|meaning',
      'gakusei|recall',
      'isha|meaning',
    ]);
    expect(weak[0]).toMatchObject({ misses: 2, answers: 2, word: byId.get('sensei') });
  });

  it('weighs a late miss more than early ones', () => {
    const answers = [
      // two misses long ago, then four rights
      answer('sensei', 'meaning', false, { day: 0 }),
      answer('sensei', 'meaning', false, { day: 1 }),
      ...[2, 3, 4, 5].map((day) => answer('sensei', 'meaning', true, { day })),
      // three rights, then a miss
      ...[0, 1, 2].map((day) => answer('isha', 'meaning', true, { day })),
      answer('isha', 'meaning', false, { day: 3 }),
    ];
    const weak = weakestCards(replay(answers), quiz, byId);
    expect(weak.map((w) => w.card.wordId)).toEqual(['isha', 'sensei']);
    expect(weak[0]).toMatchObject({ misses: 1, answers: 4 });
    expect(weak[1]).toMatchObject({ misses: 2, answers: 6 });
  });

  it('forgets misses older than the latest answers', () => {
    const answers = [answer('sensei', 'meaning', false, { day: 0 })];
    for (let i = 1; i <= RECENT_ANSWERS; i++)
      answers.push(answer('sensei', 'meaning', true, { day: i }));
    expect(weakestCards(replay(answers), quiz, byId)).toEqual([]);
  });

  it("lists only the game's cards, at most 10, leaving out missing words and cards it no longer takes", () => {
    const answers = [
      ...all.slice(0, 15).map((w) => answer(w.id, 'meaning', false)),
      answer('kaku', 'conjugation', false, { game: 'conjugation', form: 'て' }),
      answer('removed', 'meaning', false),
      answer('enjinia', 'reading', false), // no kanji now: kana typing can't ask its reading
    ];
    const cards = replay(answers);
    const quizWeak = weakestCards(cards, quiz, byId);
    expect(quizWeak).toHaveLength(10);
    expect(quizWeak.every((w) => w.card.skill === 'meaning')).toBe(true);
    expect(weakestCards(cards, conjugation, byId).map((w) => w.card)).toEqual([
      { wordId: 'kaku', skill: 'conjugation' },
    ]);
    expect(weakestCards(cards, kana, byId).map((w) => w.card.wordId)).not.toContain('enjinia');
    expect(weakestCards(cards, quiz, byId, 50).map((w) => w.card.wordId)).not.toContain('removed');
  });
});
