/**
 * Days in the app start at 04:00 local time (SPEC §10.4): practice at 1 a.m. counts for the day
 * before. Days are keys like '2026-10-13'. Pure.
 */

/** A day as 'YYYY-MM-DD'. */
export type DayKey = string;

/** The hour (local time) a new day starts. */
export const DAY_START_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

function key(year: number, month: number, day: number): DayKey {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parts(day: DayKey): [number, number, number] {
  const [y = '', m = '', d = ''] = day.split('-');
  return [Number(y), Number(m) - 1, Number(d)];
}

/**
 * The app's day for a moment: its local date, or the date before when it's under 04:00. It works
 * on the local date parts, never by subtracting 4 hours, so it holds across daylight saving.
 */
export function dayKey(date: Date): DayKey {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (date.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return key(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The day `n` days after (or before, when negative); calendar arithmetic, no time zone. */
export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = parts(day);
  const t = new Date(Date.UTC(y, m, d + n));
  return key(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** Days from `from` to `to` (negative when `to` comes first). */
export function daysBetween(from: DayKey, to: DayKey): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / 86_400_000);
}

/** When a day starts: 04:00 local time on its date. */
export function dayStart(day: DayKey): Date {
  const [y, m, d] = parts(day);
  return new Date(y, m, d, DAY_START_HOUR);
}

/** When the day after `date`'s day starts. */
export function nextDayStart(date: Date): Date {
  return dayStart(addDays(dayKey(date), 1));
}

/** The year and month (0–11) a day belongs to. */
export function monthOf(day: DayKey): { year: number; month: number } {
  const [year, month] = parts(day);
  return { year, month };
}

/** The month before or after (`n` months on). */
export function addMonths(
  { year, month }: { year: number; month: number },
  n: number,
): { year: number; month: number } {
  const t = new Date(Date.UTC(year, month + n, 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() };
}

/**
 * A month as calendar weeks starting on Sunday: each cell is a day of the month, or null for the
 * days before the 1st and after the last.
 */
export function monthGrid(year: number, month: number): (DayKey | null)[][] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (DayKey | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length }, (_, i) => key(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
