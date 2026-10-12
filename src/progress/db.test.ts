import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { appendEvent, openProgressDb, roundEvents, type ProgressDb } from './db.ts';
import { answerEvent, roundEvent } from './events.ts';

const AT = new Date('2026-10-10T12:00:00Z');
let opened: ProgressDb[] = [];

/** A fresh in-memory database per test. */
function freshDb(): ProgressDb {
  const db = openProgressDb(`test-${opened.length}-${Math.random()}`, { indexedDB, IDBKeyRange });
  opened.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(opened.map((db) => db.delete()));
  opened = [];
});

const answer = (id: string, roundId: string) =>
  answerEvent(
    {
      roundId,
      game: 'quiz',
      wordId: 'taberu',
      skill: 'meaning',
      correct: true,
      hinted: false,
      ms: 1500,
      device: 'dev-1',
    },
    id,
    AT,
  );

const round = (id: string, game: 'quiz' | 'sorter' = 'quiz', score = 500) =>
  roundEvent(
    {
      id,
      game,
      deckIds: ['verbs-g2', 'all'],
      size: 10,
      variant: 'forward',
      practice: false,
      score,
      correct: 5,
      total: 10,
    },
    AT,
  );

describe('the event log', () => {
  it('appends answer and round events', async () => {
    const db = freshDb();
    await appendEvent(answer('a1', 'r1'), db);
    await appendEvent(answer('a2', 'r1'), db);
    await appendEvent(round('r1'), db);
    const rows = await db.events.toArray();
    expect(rows.map((e) => [e.type, e.id]).sort()).toEqual([
      ['answer', 'a1'],
      ['answer', 'a2'],
      ['round', 'r1'],
    ]);
    expect(rows.find((e) => e.id === 'a1')).toEqual({
      type: 'answer',
      id: 'a1',
      at: '2026-10-10T12:00:00.000Z',
      roundId: 'r1',
      game: 'quiz',
      wordId: 'taberu',
      skill: 'meaning',
      correct: true,
      hinted: false,
      ms: 1500,
      device: 'dev-1',
    });
  });

  it('never overwrites an event: a duplicate id is rejected', async () => {
    const db = freshDb();
    await appendEvent(round('r1', 'quiz', 100), db);
    await expect(appendEvent(round('r1', 'quiz', 999), db)).rejects.toThrow();
    expect(await db.events.get('r1')).toMatchObject({ score: 100 });
  });

  it('lists the round events of one game', async () => {
    const db = freshDb();
    await appendEvent(answer('a1', 'r1'), db);
    await appendEvent(round('r1'), db);
    await appendEvent(round('r2', 'sorter'), db);
    await appendEvent(round('r3'), db);
    const rounds = await roundEvents('quiz', db);
    expect(rounds.map((r) => r.id).sort()).toEqual(['r1', 'r3']);
    expect(rounds[0]?.deckIds).toEqual(['all', 'verbs-g2']);
  });
});
