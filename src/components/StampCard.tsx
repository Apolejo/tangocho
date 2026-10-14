import { useMemo } from 'react';
import { useLang, useT } from '../i18n/hooks.ts';
import { dayStart, monthGrid, type DayKey } from '../progress/day.ts';
import { Stamp } from '../play/Stamp.tsx';
import styles from './StampCard.module.css';

/** A known Sunday, to name the weekdays in the current language. */
const A_SUNDAY = new Date(2023, 0, 1, 12);

/** A fresh day's 花丸 is drawn once its hanko has been pressed. */
const FRESH_HANAMARU_MS = 300;

/**
 * The stamp card (SPEC §10.4): a month as a calendar, with a 済 hanko on each day whose goal was
 * met and a 花丸 on each day with a perfect round. Each day says so in words for screen readers.
 * The `fresh` day's stamps are pressed onto the card as it appears (Today, once a day).
 */
export function StampCard({
  year,
  month,
  today,
  goalDays,
  perfectDays,
  fresh,
  heading,
}: {
  year: number;
  /** 0–11 */
  month: number;
  today: DayKey;
  goalDays: ReadonlySet<DayKey>;
  perfectDays: ReadonlySet<DayKey>;
  /** A day whose stamps animate, just earned. */
  fresh?: DayKey;
  /** Shown above the grid, beside the month's name (e.g. the month navigation). */
  heading?: React.ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const formats = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }),
      weekday: new Intl.DateTimeFormat(lang, { weekday: 'short' }),
      date: new Intl.DateTimeFormat(lang, { dateStyle: 'long' }),
    }),
    [lang],
  );
  const weeks = monthGrid(year, month);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    formats.weekday.format(new Date(A_SUNDAY.getFullYear(), 0, 1 + i, 12)),
  );

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <p className={styles.month}>{formats.month.format(new Date(year, month, 1, 12))}</p>
        {heading}
      </div>
      <table className={styles.grid}>
        <thead>
          <tr>
            {weekdays.map((name) => (
              <th key={name} scope="col" className={styles.weekday}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => {
                if (day === null) return <td key={`${w}-${d}`} className={styles.blank} />;
                const goal = goalDays.has(day);
                const perfect = perfectDays.has(day);
                const isToday = day === today;
                const notes = [
                  ...(isToday ? [t('stamp_today')] : []),
                  ...(goal ? [t('stamp_goal')] : []),
                  ...(perfect ? [t('stamp_perfect')] : []),
                ];
                const label = formats.date.format(dayStart(day));
                return (
                  <td
                    key={day}
                    className={styles.day}
                    data-day={day}
                    data-goal={goal || undefined}
                    data-perfect={perfect || undefined}
                    data-today={isToday || undefined}
                  >
                    <span className={styles.number} aria-hidden="true">
                      {Number(day.slice(8))}
                    </span>
                    {goal && (
                      <span className={styles.hanko}>
                        <Stamp kind="hanko" animate={day === fresh} />
                      </span>
                    )}
                    {perfect && (
                      <span className={styles.hanamaru}>
                        <Stamp kind="hanamaru" animate={day === fresh} delay={FRESH_HANAMARU_MS} />
                      </span>
                    )}
                    <span className="visually-hidden">
                      {notes.length > 0 ? `${label}: ${notes.join(', ')}` : label}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
