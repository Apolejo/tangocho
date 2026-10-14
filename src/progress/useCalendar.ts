import { useMemo } from 'react';
import type { DayKey } from './day.ts';
import { answersPerDay, goalDays, perfectDays } from './goal.ts';
import { useProgress } from './useProgress.ts';
import { useSettings } from './useSettings.ts';

/** Answers per day, goal days and 花丸 days (SPEC §10.4), for Today and Stats. */
export function useCalendar(): {
  perDay: ReadonlyMap<DayKey, number>;
  goalDays: ReadonlySet<DayKey>;
  perfectDays: ReadonlySet<DayKey>;
} {
  const { answers, rounds } = useProgress();
  const { goals } = useSettings();
  return useMemo(() => {
    const perDay = answersPerDay(answers);
    return {
      perDay,
      goalDays: goalDays(perDay, goals),
      perfectDays: perfectDays(rounds, answers),
    };
  }, [answers, rounds, goals]);
}
