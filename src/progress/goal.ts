import { addDays, dayKey, type DayKey } from './day.ts';
import type { AnswerEvent, RoundEvent } from './events.ts';
import { DEFAULT_GOAL, type GoalEntry } from './settings.ts';

/**
 * The daily goal, the streak and the stamp card (SPEC §10.4), from the log. Days are the app's
 * days (from 04:00). Pure.
 */

/** The goal on a day: the latest change made on or before it. */
export function goalOn(goals: readonly GoalEntry[], day: DayKey): number {
  let goal = DEFAULT_GOAL;
  for (const entry of goals) if (entry.from <= day) goal = entry.goal;
  return goal;
}

/** A new goal from today on; the days before keep theirs. */
export function setGoal(goals: readonly GoalEntry[], today: DayKey, goal: number): GoalEntry[] {
  return [...goals.filter((entry) => entry.from < today), { from: today, goal }];
}

/** How many answers each day has. */
export function answersPerDay(answers: readonly AnswerEvent[]): Map<DayKey, number> {
  const perDay = new Map<DayKey, number>();
  for (const answer of answers) {
    const day = dayKey(new Date(answer.at));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return perDay;
}

/** The days whose goal was met, each by the goal it had. */
export function goalDays(
  perDay: ReadonlyMap<DayKey, number>,
  goals: readonly GoalEntry[],
): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const [day, n] of perDay) if (n >= goalOn(goals, day)) days.add(day);
  return days;
}

/**
 * The days with a perfect round (the stamp card's 花丸): every answer right and none hinted.
 * The round event counts a hinted right answer as right, so its answers tell. *Practice these*
 * rounds don't count.
 */
export function perfectDays(
  rounds: readonly RoundEvent[],
  answers: readonly AnswerEvent[],
): Set<DayKey> {
  const hinted = new Set(answers.filter((a) => a.hinted).map((a) => a.roundId));
  const days = new Set<DayKey>();
  for (const round of rounds) {
    if (round.practice || round.total === 0 || round.correct !== round.total) continue;
    if (hinted.has(round.id)) continue;
    days.add(dayKey(new Date(round.at)));
  }
  return days;
}

/**
 * Consecutive goal days up to today once today's goal is met, up to yesterday until then, so
 * the streak doesn't drop to 0 every morning.
 */
export function streak(days: ReadonlySet<DayKey>, today: DayKey): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The longest run of consecutive goal days. */
export function longestStreak(days: ReadonlySet<DayKey>): number {
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let n = 1;
    while (days.has(addDays(day, n))) n++;
    longest = Math.max(longest, n);
  }
  return longest;
}

export const EXPORT_REMINDER_DAYS = 7;

/**
 * Whether Today reminds me to export (SPEC §10.1): there is progress the last export doesn't
 * have, and 7 days have passed since that export, or since the first answer if I never exported.
 */
export function exportReminder({
  lastExportAt,
  firstEventAt,
  lastEventAt,
  now,
}: {
  lastExportAt: string | undefined;
  firstEventAt: string | undefined;
  lastEventAt: string | undefined;
  now: Date;
}): boolean {
  if (firstEventAt === undefined || lastEventAt === undefined) return false;
  if (lastExportAt !== undefined && lastEventAt <= lastExportAt) return false;
  const since = new Date(lastExportAt ?? firstEventAt).getTime();
  return now.getTime() - since >= EXPORT_REMINDER_DAYS * 86_400_000;
}
