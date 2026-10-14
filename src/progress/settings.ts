import { z } from 'zod';
import type { DayKey } from './day.ts';

/**
 * Settings (SPEC §7.7) kept on this device in localStorage: the daily goal and its history, new
 * cards per day, the furigana default and the last export. The language has its own key
 * (src/i18n/lang.ts). Parsing is pure; a bad or missing field falls back to its default alone.
 */

export const GOAL_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_GOAL = 20;
export const NEW_PER_DAY_OPTIONS = [5, 10, 15, 20, 30] as const;
export const DEFAULT_NEW_PER_DAY = 15;

/** The daily goal from a day on (SPEC §10.4): a change applies from that day, not before. */
export interface GoalEntry {
  from: DayKey;
  goal: number;
}

export interface Settings {
  /** Oldest first; before the first entry the goal is DEFAULT_GOAL. */
  goals: GoalEntry[];
  newPerDay: number;
  furigana: boolean;
  /** ISO timestamp of the last export from this device. */
  lastExportAt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  goals: [],
  newPerDay: DEFAULT_NEW_PER_DAY,
  furigana: true,
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const stored = z.object({
  goals: z
    .array(z.object({ from: z.string().regex(DAY), goal: z.literal(GOAL_OPTIONS) }))
    .catch([]),
  newPerDay: z.literal(NEW_PER_DAY_OPTIONS).catch(DEFAULT_NEW_PER_DAY),
  furigana: z.boolean().catch(true),
  lastExportAt: z.iso.datetime().optional().catch(undefined),
});

export function parseSettings(raw: string | null): Settings {
  let json: unknown;
  try {
    json = raw === null ? undefined : JSON.parse(raw);
  } catch {
    json = undefined;
  }
  const parsed = stored.safeParse(json);
  if (!parsed.success) return { ...DEFAULT_SETTINGS, goals: [] };
  const { lastExportAt, goals, ...rest } = parsed.data;
  return {
    ...rest,
    goals: [...goals].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)),
    ...(lastExportAt !== undefined && { lastExportAt }),
  };
}

export const SETTINGS_KEY = 'tangocho:settings';

let current: Settings | undefined;
const listeners = new Set<() => void>();

/** The settings, read once from localStorage. */
export function getSettings(): Settings {
  if (current === undefined) {
    try {
      current = parseSettings(localStorage.getItem(SETTINGS_KEY));
    } catch {
      current = { ...DEFAULT_SETTINGS, goals: [] };
    }
  }
  return current;
}

/** Changes the settings and saves them; storage that fails keeps them for this visit. */
export function updateSettings(change: (settings: Settings) => Settings): void {
  current = change(getSettings());
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    // storage disabled: the settings last for this visit only
  }
  for (const listener of listeners) listener();
}

export function subscribeSettings(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
