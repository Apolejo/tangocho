import { Dexie, type DexieOptions, type Table } from 'dexie';
import type { GameId } from '../games/types.ts';
import type { AnswerEvent, ProgressEvent, RoundEvent } from './events.ts';

/** The progress log in IndexedDB (SPEC §10.1), through Dexie. */

export type ProgressDb = Dexie & { events: Table<ProgressEvent, string> };

export const DB_NAME = 'tangocho';

/** `options` lets tests pass an in-memory IndexedDB. */
export function openProgressDb(name = DB_NAME, options?: DexieOptions): ProgressDb {
  const db = new Dexie(name, options) as ProgressDb;
  db.version(1).stores({ events: 'id, type, at, [type+game], wordId, roundId' });
  return db;
}

let shared: ProgressDb | undefined;

function progressDb(): ProgressDb {
  shared ??= openProgressDb();
  return shared;
}

/** Appends one event. Events are never changed: a second event with the same id is an error. */
export async function appendEvent(event: ProgressEvent, db = progressDb()): Promise<void> {
  await db.events.add(event);
}

export async function roundEvents(game: GameId, db = progressDb()): Promise<RoundEvent[]> {
  const rows = await db.events.where('[type+game]').equals(['round', game]).toArray();
  return rows.filter((e): e is RoundEvent => e.type === 'round');
}

export async function answerEvents(game: GameId, db = progressDb()): Promise<AnswerEvent[]> {
  const rows = await db.events.where('[type+game]').equals(['answer', game]).toArray();
  return rows.filter((e): e is AnswerEvent => e.type === 'answer');
}
