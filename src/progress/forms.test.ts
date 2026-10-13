import { describe, expect, it } from 'vitest';
import { answerEvent, type AnswerEvent } from './events.ts';
import { RECENT_ANSWERS, formStats, formWeight } from './forms.ts';

let n = 0;
/** An answer to a form, `minutes` after a fixed start. */
const answer = (form: string | undefined, correct: boolean, minutes: number): AnswerEvent =>
  answerEvent(
    {
      roundId: 'r',
      game: 'conjugation',
      wordId: 'kaku',
      skill: 'conjugation',
      ...(form !== undefined && { form }),
      correct,
      hinted: false,
      ms: 900,
      device: 'd',
    },
    `a${n++}`,
    new Date(Date.UTC(2026, 9, 13, 12, minutes)),
  );

describe('formStats', () => {
  it('counts answers and misses per form, ignoring answers without one', () => {
    const stats = formStats([
      answer('て', false, 1),
      answer('て', true, 2),
      answer('ない', true, 3),
      answer(undefined, false, 4),
    ]);
    expect(Object.fromEntries(stats)).toEqual({
      て: { answers: 2, misses: 1 },
      ない: { answers: 1, misses: 0 },
    });
  });

  it('keeps only the latest answers of each form', () => {
    // old misses, then RECENT_ANSWERS right answers, given out of order
    const events = [
      ...Array.from({ length: RECENT_ANSWERS }, (_, i) => answer('た', true, 30 + i)),
      ...Array.from({ length: 5 }, (_, i) => answer('た', false, i)),
    ].reverse();
    expect(formStats(events).get('た')).toEqual({ answers: RECENT_ANSWERS, misses: 0 });
  });
});

describe('formWeight', () => {
  it('puts a form never asked between one always missed and one never missed', () => {
    const never = formWeight({ answers: RECENT_ANSWERS, misses: 0 });
    const always = formWeight({ answers: RECENT_ANSWERS, misses: RECENT_ANSWERS });
    const unseen = formWeight(undefined);
    expect(unseen).toBe(2.5);
    expect(never).toBeLessThan(unseen);
    expect(always).toBeGreaterThan(unseen);
    expect(always / never).toBeCloseTo(3.4, 1);
  });
});
