import { useEffect, useState } from 'react';
import type { DayKey } from '../../progress/day.ts';

/**
 * Today presses the day's hanko onto the stamp card once (SPEC §10.4): the first time it shows
 * the stamp after the goal is met. The day is remembered on this device, so coming back to Today
 * or reloading shows the stamp already there.
 */
export const STAMPED_KEY = 'tangocho:stamped';

/** The day to press: today, when its goal is met and its stamp hasn't been pressed yet. */
export function freshStampDay(
  today: DayKey,
  goalMet: boolean,
  stamped: string | null,
): DayKey | undefined {
  return goalMet && stamped !== today ? today : undefined;
}

function readStamped(): string | null {
  try {
    return localStorage.getItem(STAMPED_KEY);
  } catch {
    return null;
  }
}

/** Decided once, when the progress has loaded, and remembered right away. */
export function useFreshStamp(today: DayKey, ready: boolean, goalMet: boolean): DayKey | undefined {
  const [decision, setDecision] = useState<{ day: DayKey | undefined }>();
  if (decision === undefined && ready) {
    setDecision({ day: freshStampDay(today, goalMet, readStamped()) });
  }
  const day = decision?.day;
  useEffect(() => {
    if (day === undefined) return;
    try {
      localStorage.setItem(STAMPED_KEY, day);
    } catch {
      // storage disabled: the stamp presses again on the next visit
    }
  }, [day]);
  return day;
}
