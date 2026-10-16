import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { Skill } from '../games/types.ts';
import { answerEvent, type AnswerEvent } from './events.ts';
import { RECENT_ANSWERS } from './forms.ts';
import {
  cardKey,
  isDue,
  rating,
  recentMisses,
  replay,
  review,
  weakness,
  type CardState,
} from './srs.ts';

const MINUTE = 60_000;
let n = 0;

/** An answer at a moment (a local Date, so the 04:00 rule holds in any time zone). */
function answer(
  at: Date,
  correct: boolean,
  { wordId = 'taberu', skill = 'meaning' as Skill, hinted = false, id = `a${n++}` } = {},
): AnswerEvent {
  return answerEvent(
    { roundId: 'r', game: 'quiz', wordId, skill, correct, hinted, ms: 1000, device: 'd' },
    id,
    at,
  );
}

const only = (cards: Map<string, CardState>, key = cardKey('taberu', 'meaning')): CardState => {
  const state = cards.get(key);
  if (state === undefined) throw new Error(`no card ${key}`);
  return state;
};

describe('rating: answer → FSRS rating (SPEC §10.2)', () => {
  it('maps wrong to Again, a hinted right answer to Hard and a right one to Good', () => {
    expect(rating({ correct: false, hinted: false })).toBe(Rating.Again);
    expect(rating({ correct: false, hinted: true })).toBe(Rating.Again);
    expect(rating({ correct: true, hinted: true })).toBe(Rating.Hard);
    expect(rating({ correct: true, hinted: false })).toBe(Rating.Good);
  });

  it('never infers Easy', () => {
    const all = [true, false].flatMap((correct) =>
      [true, false].map((hinted) => rating({ correct, hinted })),
    );
    expect(all).not.toContain(Rating.Easy);
  });
});

describe('replay', () => {
  const t0 = new Date(2026, 9, 13, 12, 0);

  it('keys cards by word and skill, not by form', () => {
    const cards = replay([
      answer(t0, true),
      answer(t0, true, { skill: 'recall' }),
      answer(t0, true, { wordId: 'kaku', skill: 'conjugation' }),
      {
        ...answer(new Date(t0.getTime() + MINUTE), false, { wordId: 'kaku', skill: 'conjugation' }),
        form: 'て',
      },
    ]);
    expect([...cards.keys()].sort()).toEqual([
      'kaku|conjugation',
      'taberu|meaning',
      'taberu|recall',
    ]);
    expect(only(cards, 'kaku|conjugation').answers).toBe(2);
  });

  it('gives the same state whatever order the events come in (a merge of two devices)', () => {
    const events = [
      answer(t0, true, { id: 'p1' }),
      answer(new Date(t0.getTime() + 11 * MINUTE), false, { id: 'c1' }),
      answer(new Date(t0.getTime() + 30 * MINUTE), true, { id: 'p2' }),
      answer(new Date(t0.getTime() + 2 * 86_400_000), true, { id: 'c2', hinted: true }),
      // same moment on both devices: the id decides
      answer(new Date(t0.getTime() + 3 * 86_400_000), true, { id: 'x2' }),
      answer(new Date(t0.getTime() + 3 * 86_400_000), false, { id: 'x1' }),
    ];
    const sorted = replay(events);
    const shuffled = replay([
      events[4]!,
      events[2]!,
      events[0]!,
      events[5]!,
      events[3]!,
      events[1]!,
    ]);
    expect(shuffled).toEqual(sorted);
  });

  it('starts a new card in a short learning step: Good in 10 minutes, Again in 1', () => {
    const good = only(replay([answer(t0, true)]));
    expect(good.fsrs.state).toBe(State.Learning);
    expect(good.fsrs.due).toEqual(new Date(t0.getTime() + 10 * MINUTE));
    expect(good.misses).toBe(0);

    const again = only(replay([answer(t0, false)]));
    expect(again.fsrs.due).toEqual(new Date(t0.getTime() + MINUTE));
    expect(again.misses).toBe(1);
    expect(again.fsrs.lapses).toBe(0);
  });

  it('graduates a card to days after a second Good', () => {
    const state = only(
      replay([answer(t0, true), answer(new Date(t0.getTime() + 11 * MINUTE), true)]),
    );
    expect(state.fsrs.state).toBe(State.Review);
    expect(state.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(state.firstAt).toBe(t0.toISOString());
    expect(state.answers).toBe(2);
  });

  it('remembers only the latest answers for the recent misses', () => {
    let state: CardState | undefined;
    for (let i = 0; i < RECENT_ANSWERS + 5; i++) {
      state = review(state, answer(new Date(t0.getTime() + i * 86_400_000), i >= 5));
    }
    expect(state?.misses).toBe(5);
    expect(state?.recent).toHaveLength(RECENT_ANSWERS);
    expect(state && recentMisses(state)).toBe(0);
  });
});

describe('isDue', () => {
  const t0 = new Date(2026, 9, 13, 12, 0);

  it('holds a learning step until its exact time', () => {
    const state = only(replay([answer(t0, true)]));
    expect(isDue(state, new Date(t0.getTime() + 9 * MINUTE))).toBe(false);
    expect(isDue(state, new Date(t0.getTime() + 10 * MINUTE))).toBe(true);
  });

  it('makes a card scheduled in days due from 04:00 on its due day', () => {
    const state = only(
      replay([answer(t0, true), answer(new Date(t0.getTime() + 11 * MINUTE), true)]),
    );
    const days = state.fsrs.scheduled_days;
    const dueDate = new Date(2026, 9, 13 + days);
    // the evening before, and at 03:59 on the due date, it still belongs to the day before
    expect(isDue(state, new Date(2026, 9, 13 + days - 1, 23, 0))).toBe(false);
    expect(isDue(state, new Date(2026, 9, 13 + days, 3, 59))).toBe(false);
    // from 04:00 on the due day, hours before the time of day it was answered
    expect(
      isDue(state, new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 4, 0)),
    ).toBe(true);
  });

  it('counts a review made at 03:30 for the day before', () => {
    const late = new Date(2026, 9, 14, 3, 30); // still the 13th
    const state = only(replay([answer(new Date(2026, 9, 14, 3, 0), true), answer(late, true)]));
    const days = state.fsrs.scheduled_days;
    expect(days).toBeGreaterThanOrEqual(1);
    // due on the 13th + days, so from 04:00 on that date
    expect(isDue(state, new Date(2026, 9, 13 + days, 4, 0))).toBe(true);
    expect(isDue(state, new Date(2026, 9, 13 + days, 3, 59))).toBe(false);
  });
});

describe('weakness (SPEC §10.2)', () => {
  /** The card's weakness after these answers, 20 minutes apart, oldest first. */
  const after = (...results: boolean[]): number =>
    weakness(
      only(replay(results.map((correct, i) => answer(new Date(2026, 9, 12, 12, i * 20), correct)))),
    );
  const rights = (n: number): boolean[] => Array.from({ length: n }, () => true);

  it('is 0.5 for a card never seen, and never takes one right answer for granted', () => {
    expect(weakness(undefined)).toBe(0.5);
    expect(after(true)).toBeCloseTo(1 / 3);
    expect(after(true, true)).toBeCloseTo(1 / 3.8);
  });

  it('falls with every right answer, the latest counting most', () => {
    expect(after(...rights(3))).toBeCloseTo(0.225, 2);
    expect(after(...rights(10))).toBeCloseTo(0.155, 2);
    expect(after(...rights(20))).toBeCloseTo(0.144, 2);
  });

  it('rises with a miss, a late one more than an early one', () => {
    expect(after(false)).toBeCloseTo(2 / 3);
    expect(after(true, false)).toBeGreaterThan(after(false, true));
    expect(after(...rights(5), false)).toBeCloseTo(0.35, 1);
    expect(after(...rights(5), false)).toBeGreaterThan(after(...rights(5)));
  });

  it('looks at the last 20 answers only', () => {
    expect(after(false, ...rights(RECENT_ANSWERS))).toBe(after(...rights(RECENT_ANSWERS)));
  });
});
