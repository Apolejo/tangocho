import { describe, expect, it } from 'vitest';
import type { AnswerResult } from '../games/types.ts';
import type { QueuedCard } from './queue.ts';
import {
  isLastQuestion,
  missedCards,
  missedWordIds,
  roundReducer,
  startRound,
  type RoundState,
} from './round.ts';

const queue: QueuedCard[] = ['kau', 'kaku', 'taberu'].map((wordId, i) => ({
  card: { wordId, skill: 'meaning' },
  seed: i,
}));

const result = (correct: boolean): AnswerResult => ({
  correct,
  hinted: false,
  given: 'x',
  expected: 'y',
});

const answer = (s: RoundState, correct: boolean): RoundState =>
  roundReducer(s, { type: 'answer', result: result(correct), ms: 1200 });
const next = (s: RoundState): RoundState => roundReducer(s, { type: 'next' });

describe('roundReducer', () => {
  it('goes question → feedback → next question … → done', () => {
    let s = startRound(queue);
    expect(s).toMatchObject({ index: 0, phase: 'question' });
    s = answer(s, true);
    expect(s).toMatchObject({ index: 0, phase: 'feedback' });
    s = next(s);
    expect(s).toMatchObject({ index: 1, phase: 'question' });
    s = next(answer(s, false));
    expect(isLastQuestion(s)).toBe(true);
    s = answer(s, true);
    expect(s.phase).toBe('feedback');
    s = next(s);
    expect(s.phase).toBe('done');
    expect(s.tally).toEqual({ score: 200, streak: 1, answered: 3, correct: 2, hinted: 0 });
  });

  it('records each answer with its card, points and time', () => {
    const s = answer(next(answer(startRound(queue), true)), true);
    expect(s.answers.map((a) => [a.card.wordId, a.points, a.ms])).toEqual([
      ['kau', 100, 1200],
      ['kaku', 110, 1200],
    ]);
  });

  it('takes exactly one answer per question', () => {
    const once = answer(startRound(queue), false);
    const twice = answer(once, true);
    expect(twice).toBe(once);
    expect(twice.answers).toHaveLength(1);
  });

  it('ignores next while a question is open', () => {
    const s = startRound(queue);
    expect(next(s)).toBe(s);
  });

  it('is done at once with an empty queue', () => {
    expect(startRound([]).phase).toBe('done');
  });
});

describe('missedWordIds', () => {
  it('lists the missed words once each, in order', () => {
    let s = startRound([...queue, { card: { wordId: 'kau', skill: 'recall' }, seed: 9 }]);
    for (const correct of [false, true, false, false]) s = next(answer(s, correct));
    expect(missedWordIds(s.answers)).toEqual(['kau', 'taberu']);
  });
});

describe('missedCards', () => {
  it('keeps the skill and form of each missed card, one per word', () => {
    const drill: QueuedCard[] = [
      { card: { wordId: 'kaku', skill: 'conjugation', form: 'て' }, seed: 1 },
      { card: { wordId: 'kau', skill: 'conjugation', form: 'ない' }, seed: 2 },
      { card: { wordId: 'taberu', skill: 'conjugation', form: 'た' }, seed: 3 },
      { card: { wordId: 'kaku', skill: 'conjugation', form: 'ます' }, seed: 4 },
    ];
    let s = startRound(drill);
    for (const correct of [false, true, false, false]) s = next(answer(s, correct));
    expect(missedCards(s.answers)).toEqual([
      { wordId: 'kaku', skill: 'conjugation', form: 'て' },
      { wordId: 'taberu', skill: 'conjugation', form: 'た' },
    ]);
  });
});
