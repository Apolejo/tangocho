import type { AnswerEvent } from './events.ts';

/**
 * How often each conjugation form is missed, from the answer log (SPEC §9.4: forms I miss more
 * often come up more often). Pure; the queue turns these into weights.
 */

/** How many of a form's latest answers count. */
export const RECENT_ANSWERS = 20;

export interface FormRecord {
  answers: number;
  misses: number;
}

export type FormStats = ReadonlyMap<string, FormRecord>;

/** Per form, the answers and misses among its latest RECENT_ANSWERS answers. */
export function formStats(events: readonly AnswerEvent[]): Map<string, FormRecord> {
  const byForm = new Map<string, AnswerEvent[]>();
  for (const event of events) {
    if (event.form === undefined) continue;
    const list = byForm.get(event.form) ?? [];
    list.push(event);
    byForm.set(event.form, list);
  }
  const stats = new Map<string, FormRecord>();
  for (const [form, list] of byForm) {
    // ISO timestamps in UTC sort as text
    const recent = [...list].sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_ANSWERS);
    stats.set(form, {
      answers: recent.length,
      misses: recent.filter((e) => !e.correct).length,
    });
  }
  return stats;
}

/**
 * A form's weight in the queue: 1 + 3 × its miss rate, counted as (misses + 1) / (answers + 2)
 * so a form never asked sits in the middle (2.5). A form missed every time comes up about 3.4×
 * as often as one never missed.
 */
export function formWeight(record: FormRecord | undefined): number {
  const answers = record?.answers ?? 0;
  const misses = record?.misses ?? 0;
  return 1 + (3 * (misses + 1)) / (answers + 2);
}
