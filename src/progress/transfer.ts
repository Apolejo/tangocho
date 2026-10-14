import { z } from 'zod';
import { GAME_IDS, SKILLS } from '../games/types.ts';
import type { AnswerEvent, ProgressEvent, RoundEvent } from './events.ts';
import type { ProgressStore } from './store.ts';

/**
 * Moving progress between devices (SPEC §10.1): export writes the whole event log to a JSON
 * file; import reads one back and merges it by event id. Parsing is pure.
 */

export const FILE_APP = 'tangocho';
export const FILE_VERSION = 1;

export interface ProgressFile {
  app: typeof FILE_APP;
  version: typeof FILE_VERSION;
  exportedAt: string;
  /** The install that exported it. */
  device: string;
  events: ProgressEvent[];
}

export function progressFile(
  events: readonly ProgressEvent[],
  device: string,
  now: Date,
): ProgressFile {
  return {
    app: FILE_APP,
    version: FILE_VERSION,
    exportedAt: now.toISOString(),
    device,
    events: [...events],
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `tangocho-progress-2026-10-13.json`, by the local calendar date. */
export function exportFileName(now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${FILE_APP}-progress-${date}.json`;
}

/** Exactly what Date#toISOString writes: the log sorts these as text. */
const isoInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const id = z.string().min(1);

const answerSchema = z.object({
  type: z.literal('answer'),
  id,
  at: isoInstant,
  roundId: id,
  game: z.enum(GAME_IDS),
  wordId: id,
  skill: z.enum(SKILLS),
  form: z.string().min(1).optional(),
  correct: z.boolean(),
  hinted: z.boolean(),
  ms: z.number().nonnegative(),
  device: z.string(),
}) satisfies z.ZodType<AnswerEvent>;

const roundSchema = z.object({
  type: z.literal('round'),
  id,
  at: isoInstant,
  game: z.enum(GAME_IDS),
  deckIds: z.array(z.string()),
  size: z.number().int().nonnegative(),
  variant: z.string(),
  practice: z.boolean(),
  score: z.number().nonnegative(),
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}) satisfies z.ZodType<RoundEvent>;

const eventSchema = z.discriminatedUnion('type', [answerSchema, roundSchema]);

const fileSchema = z.object({
  app: z.literal(FILE_APP),
  version: z.number().int().positive(),
  events: z.array(z.unknown()),
});

export type ParseFailure = 'not-json' | 'not-tangocho' | 'newer-version';

export type ParsedFile =
  { ok: true; events: ProgressEvent[]; skipped: number } | { ok: false; reason: ParseFailure };

/**
 * Reads an export. The file as a whole must be a Tangochō export of a version this app knows;
 * within it, an event that isn't valid is skipped and counted, and a repeated id is kept once.
 */
export function parseProgressFile(text: string): ParsedFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  const file = fileSchema.safeParse(json);
  if (!file.success) return { ok: false, reason: 'not-tangocho' };
  if (file.data.version > FILE_VERSION) return { ok: false, reason: 'newer-version' };
  const byId = new Map<string, ProgressEvent>();
  let skipped = 0;
  for (const raw of file.data.events) {
    const event = eventSchema.safeParse(raw);
    if (!event.success) skipped++;
    else if (!byId.has(event.data.id)) byId.set(event.data.id, event.data);
  }
  return { ok: true, events: [...byId.values()], skipped };
}

export type ImportOutcome =
  | { ok: true; added: number; existing: number; skipped: number }
  | { ok: false; reason: ParseFailure };

/** Reads an export and merges it into the log (an event already here is never overwritten). */
export async function importProgressFile(
  text: string,
  store: Pick<ProgressStore, 'importEvents'>,
): Promise<ImportOutcome> {
  const parsed = parseProgressFile(text);
  if (!parsed.ok) return parsed;
  const { added, existing } = await store.importEvents(parsed.events);
  return { ok: true, added, existing, skipped: parsed.skipped };
}
