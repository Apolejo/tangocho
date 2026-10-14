import { describe, expect, it } from 'vitest';
import type { DayKey } from './day.ts';
import { answerEvent, roundEvent, type AnswerEvent, type RoundEvent } from './events.ts';
import {
  answersPerDay,
  exportReminder,
  goalDays,
  goalOn,
  longestStreak,
  perfectDays,
  setGoal,
  streak,
} from './goal.ts';
import { DEFAULT_GOAL } from './settings.ts';

let n = 0;
const answer = (at: Date, { roundId = 'r', hinted = false, correct = true } = {}): AnswerEvent =>
  answerEvent(
    {
      roundId,
      game: 'quiz',
      wordId: 'taberu',
      skill: 'meaning',
      correct,
      hinted,
      ms: 900,
      device: 'd',
    },
    `a${n++}`,
    at,
  );

const round = (id: string, at: Date, over: Partial<RoundEvent> = {}): RoundEvent =>
  roundEvent(
    {
      id,
      game: 'quiz',
      deckIds: ['all'],
      size: 10,
      variant: 'forward',
      practice: false,
      score: 1000,
      correct: 10,
      total: 10,
      ...over,
    },
    at,
  );

const days = (...keys: DayKey[]) => new Set(keys);

describe('daily goal (SPEC §10.4)', () => {
  it('is the default until changed, then the latest change on or before the day', () => {
    expect(goalOn([], '2026-10-13')).toBe(DEFAULT_GOAL);
    const goals = [
      { from: '2026-10-10', goal: 10 },
      { from: '2026-10-20', goal: 50 },
    ];
    expect(goalOn(goals, '2026-10-09')).toBe(DEFAULT_GOAL);
    expect(goalOn(goals, '2026-10-10')).toBe(10);
    expect(goalOn(goals, '2026-10-19')).toBe(10);
    expect(goalOn(goals, '2026-10-20')).toBe(50);
  });

  it('changes from today on: the days before keep their goal', () => {
    let goals = setGoal([], '2026-10-13', 50);
    goals = setGoal(goals, '2026-10-13', 10); // changed again the same day: the last one counts
    expect(goals).toEqual([{ from: '2026-10-13', goal: 10 }]);
    goals = setGoal(goals, '2026-10-15', 50);
    expect(goalOn(goals, '2026-10-12')).toBe(DEFAULT_GOAL);
    expect(goalOn(goals, '2026-10-14')).toBe(10);
    expect(goalOn(goals, '2026-10-15')).toBe(50);
  });

  it('counts answers at 1 a.m. for the day before', () => {
    const perDay = answersPerDay([
      answer(new Date(2026, 9, 13, 22, 0)),
      answer(new Date(2026, 9, 14, 1, 0)),
      answer(new Date(2026, 9, 14, 4, 0)),
    ]);
    expect(perDay).toEqual(
      new Map([
        ['2026-10-13', 2],
        ['2026-10-14', 1],
      ]),
    );
  });

  it('judges each day by the goal it had, so raising the goal keeps past days', () => {
    const perDay = new Map([
      ['2026-10-11', 20],
      ['2026-10-12', 15],
      ['2026-10-13', 20],
    ]);
    // raised to 50 on the 13th: the 11th still met its 20, the 13th doesn't meet 50
    expect(goalDays(perDay, [{ from: '2026-10-13', goal: 50 }])).toEqual(days('2026-10-11'));
    // lowered to 10 on the 13th: the 12th (15 of 20) stays unmet
    expect(goalDays(perDay, [{ from: '2026-10-13', goal: 10 }])).toEqual(
      days('2026-10-11', '2026-10-13'),
    );
  });
});

describe('streak', () => {
  it('counts up to today once today is met', () => {
    expect(streak(days('2026-10-11', '2026-10-12', '2026-10-13'), '2026-10-13')).toBe(3);
  });

  it('counts up to yesterday while today is not met yet', () => {
    expect(streak(days('2026-10-11', '2026-10-12'), '2026-10-13')).toBe(2);
  });

  it('breaks on a missed day, and is 0 with nothing', () => {
    expect(streak(days('2026-10-09', '2026-10-10', '2026-10-12'), '2026-10-13')).toBe(1);
    expect(streak(days('2026-10-09', '2026-10-10'), '2026-10-13')).toBe(0);
    expect(streak(days(), '2026-10-13')).toBe(0);
  });

  it('finds the longest run, across months', () => {
    expect(longestStreak(days())).toBe(0);
    expect(
      longestStreak(days('2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05', '2026-10-06')),
    ).toBe(3);
  });
});

describe('perfectDays (花丸 on the stamp card)', () => {
  const day1 = new Date(2026, 9, 12, 20, 0);
  const day2 = new Date(2026, 9, 13, 2, 0); // 2 a.m.: still the 12th
  const day3 = new Date(2026, 9, 14, 9, 0);

  it('marks the days with a round all right and unhinted', () => {
    expect(perfectDays([round('p', day1)], [])).toEqual(days('2026-10-12'));
    expect(perfectDays([round('p', day2)], [])).toEqual(days('2026-10-12'));
  });

  it('leaves out rounds with a miss, a hint, practice rounds and empty rounds', () => {
    const rounds = [
      round('missed', day3, { correct: 9 }),
      round('hinted', day3),
      round('practice', day3, { practice: true }),
      round('empty', day3, { correct: 0, total: 0 }),
    ];
    const answers = [answer(day3, { roundId: 'hinted', hinted: true })];
    expect(perfectDays(rounds, answers)).toEqual(days());
  });
});

describe('exportReminder', () => {
  const DAY = 86_400_000;
  const now = new Date(Date.UTC(2026, 9, 20, 12));
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();

  it('stays quiet without progress', () => {
    expect(
      exportReminder({
        lastExportAt: undefined,
        firstEventAt: undefined,
        lastEventAt: undefined,
        now,
      }),
    ).toBe(false);
  });

  it('waits 7 days from the first answer when never exported', () => {
    expect(
      exportReminder({ lastExportAt: undefined, firstEventAt: ago(6), lastEventAt: ago(0), now }),
    ).toBe(false);
    expect(
      exportReminder({ lastExportAt: undefined, firstEventAt: ago(7), lastEventAt: ago(0), now }),
    ).toBe(true);
  });

  it('waits 7 days from the last export, and only for progress made since', () => {
    expect(
      exportReminder({ lastExportAt: ago(6), firstEventAt: ago(30), lastEventAt: ago(0), now }),
    ).toBe(false);
    expect(
      exportReminder({ lastExportAt: ago(8), firstEventAt: ago(30), lastEventAt: ago(0), now }),
    ).toBe(true);
    expect(
      exportReminder({ lastExportAt: ago(8), firstEventAt: ago(30), lastEventAt: ago(9), now }),
    ).toBe(false);
  });
});
