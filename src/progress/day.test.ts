import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  addMonths,
  dayKey,
  dayStart,
  daysBetween,
  monthGrid,
  monthOf,
  nextDayStart,
} from './day.ts';

// Dates are built from local parts (month 9 = October), so these pass in any time zone.
describe('dayKey: the day starts at 04:00 (SPEC §10.4)', () => {
  it('puts 03:59 on the day before and 04:00 on the day itself', () => {
    expect(dayKey(new Date(2026, 9, 14, 3, 59, 59))).toBe('2026-10-13');
    expect(dayKey(new Date(2026, 9, 14, 4, 0))).toBe('2026-10-14');
  });

  it('counts practice at 1 a.m. and at midnight for the day before', () => {
    expect(dayKey(new Date(2026, 9, 14, 1, 0))).toBe('2026-10-13');
    expect(dayKey(new Date(2026, 9, 14, 0, 0))).toBe('2026-10-13');
  });

  it('keeps 23:59 on its own date', () => {
    expect(dayKey(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13');
  });

  it('rolls back across months, years and leap days', () => {
    expect(dayKey(new Date(2026, 10, 1, 2, 0))).toBe('2026-10-31');
    expect(dayKey(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31');
    expect(dayKey(new Date(2028, 2, 1, 3, 0))).toBe('2028-02-29');
  });
});

describe('day arithmetic', () => {
  it('adds and subtracts days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-10-13', 0)).toBe('2026-10-13');
  });

  it('counts the days between two days', () => {
    expect(daysBetween('2026-10-13', '2026-10-20')).toBe(7);
    expect(daysBetween('2026-10-20', '2026-10-13')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('starts a day at 04:00 local time, and knows when the next one starts', () => {
    expect(dayStart('2026-10-13')).toEqual(new Date(2026, 9, 13, 4, 0));
    expect(nextDayStart(new Date(2026, 9, 13, 12, 0))).toEqual(new Date(2026, 9, 14, 4, 0));
    // at 2 a.m. it is still the 13th, so the next day starts at 04:00 the same night
    expect(nextDayStart(new Date(2026, 9, 14, 2, 0))).toEqual(new Date(2026, 9, 14, 4, 0));
  });

  it('moves between months', () => {
    expect(monthOf('2026-10-13')).toEqual({ year: 2026, month: 9 });
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('monthGrid', () => {
  it('lays a month out in weeks starting on Sunday', () => {
    // October 2026 starts on a Thursday and has 31 days
    const weeks = monthGrid(2026, 9);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4]).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('handles February in a leap year', () => {
    const days = monthGrid(2028, 1)
      .flat()
      .filter((d) => d !== null);
    expect(days).toHaveLength(29);
    expect(days.at(-1)).toBe('2028-02-29');
  });
});

// Daylight saving moves the clock by an hour; the day boundary must stay at 04:00 local time.
describe('across daylight saving (America/New_York)', () => {
  // Node picks up a new TZ at once, on Windows too
  beforeAll(() => {
    vi.stubEnv('TZ', 'America/New_York');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the boundary at 04:00 on the day the clocks go forward', () => {
    // 2026-03-08: 02:00 EST → 03:00 EDT. Subtracting 4 hours from 04:30 EDT would land on the 7th.
    expect(dayKey(new Date(2026, 2, 8, 3, 30))).toBe('2026-03-07');
    expect(dayKey(new Date(2026, 2, 8, 4, 30))).toBe('2026-03-08');
    expect(dayStart('2026-03-08').toISOString()).toBe('2026-03-08T08:00:00.000Z');
  });

  it('keeps the boundary at 04:00 on the day the clocks go back', () => {
    // 2026-11-01: 02:00 EDT → 01:00 EST
    expect(dayKey(new Date(2026, 10, 1, 3, 59))).toBe('2026-10-31');
    expect(dayKey(new Date(2026, 10, 1, 4, 0))).toBe('2026-11-01');
    expect(nextDayStart(new Date(2026, 9, 31, 12)).toISOString()).toBe('2026-11-01T09:00:00.000Z');
  });
});
