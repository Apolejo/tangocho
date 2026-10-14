import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { allEvents, appendEvent, openProgressDb, type ProgressDb } from './db.ts';
import { answerEvent, roundEvent, type AnswerEvent } from './events.ts';
import { replay } from './srs.ts';
import { createProgressStore } from './store.ts';

let opened: ProgressDb[] = [];

/** A fresh in-memory database per test. */
function freshDb(): ProgressDb {
  const db = openProgressDb(`store-${opened.length}-${Math.random()}`, { indexedDB, IDBKeyRange });
  opened.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(opened.map((db) => db.delete()));
  opened = [];
});

const answer = (id: string, minutes: number, correct = true, wordId = 'taberu'): AnswerEvent =>
  answerEvent(
    {
      roundId: 'r1',
      game: 'quiz',
      wordId,
      skill: 'meaning',
      correct,
      hinted: false,
      ms: 1000,
      device: 'phone',
    },
    id,
    new Date(Date.UTC(2026, 9, 13, 12, minutes)),
  );

const round = (id: string, minutes: number) =>
  roundEvent(
    {
      id,
      game: 'quiz',
      deckIds: ['all'],
      size: 10,
      variant: 'forward',
      practice: false,
      score: 100,
      correct: 1,
      total: 1,
    },
    new Date(Date.UTC(2026, 9, 13, 12, minutes)),
  );

/** Lets the fire-and-forget writes finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('progress store', () => {
  it('loads the log and derives the card states', async () => {
    const db = freshDb();
    const events = [answer('a1', 1), answer('a2', 30, false), round('r1', 31)];
    for (const e of events) await appendEvent(e, db);
    const store = createProgressStore(() => db);
    expect(store.getSnapshot().status).toBe('loading');

    await store.load();
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.events.map((e) => e.id)).toEqual(['a1', 'a2', 'r1']);
    expect(snapshot.answers).toHaveLength(2);
    expect(snapshot.rounds).toHaveLength(1);
    expect(snapshot.cards).toEqual(replay(events.filter((e) => e.type === 'answer')));
  });

  it('gives the same state when an answer is recorded before the load finishes', async () => {
    const db = freshDb();
    await appendEvent(answer('a1', 1), db);
    const early = createProgressStore(() => db);
    const loading = early.load();
    early.record(answer('a2', 20, false));
    await loading;
    await settled();

    const late = createProgressStore(() => db);
    await late.load();
    expect(early.getSnapshot().events.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(early.getSnapshot().cards).toEqual(late.getSnapshot().cards);
  });

  it('records an event once, in memory at once and in the database after', async () => {
    const db = freshDb();
    const store = createProgressStore(() => db);
    await store.load();
    let changes = 0;
    store.subscribe(() => changes++);
    store.record(answer('a1', 1));
    store.record(answer('a1', 1));
    expect(store.getSnapshot().answers).toHaveLength(1);
    expect(store.getSnapshot().cards.get('taberu|meaning')?.answers).toBe(1);
    expect(changes).toBe(1);
    await settled();
    expect(await allEvents(db)).toHaveLength(1);
  });

  it("replays a card when an answer arrives older than the card's latest", async () => {
    const db = freshDb();
    const store = createProgressStore(() => db);
    await store.load();
    store.record(answer('a2', 30));
    store.record(answer('a1', 1, false));
    const expected = replay([answer('a1', 1, false), answer('a2', 30)]);
    expect(store.getSnapshot().cards).toEqual(expected);
    expect(store.getSnapshot().events.map((e) => e.id)).toEqual(['a1', 'a2']);
  });

  it('merges an import and rebuilds; a second import of the same events adds nothing', async () => {
    const db = freshDb();
    const store = createProgressStore(() => db);
    await store.load();
    store.record(answer('mine', 1));
    const theirs = [
      answer('t1', 5, true, 'kaku'),
      answer('t2', 40, false, 'kaku'),
      round('tr', 41),
    ];

    expect(await store.importEvents(theirs)).toEqual({ added: 3, existing: 0 });
    const once = store.getSnapshot();
    expect(once.events.map((e) => e.id)).toEqual(['mine', 't1', 't2', 'tr']);
    expect(once.cards.get('kaku|meaning')?.answers).toBe(2);

    expect(await store.importEvents(theirs)).toEqual({ added: 0, existing: 3 });
    expect(store.getSnapshot().events).toEqual(once.events);
    expect(store.getSnapshot().cards).toEqual(once.cards);
  });

  it('empties the log on reset', async () => {
    const db = freshDb();
    await appendEvent(answer('a1', 1), db);
    const store = createProgressStore(() => db);
    await store.load();
    await store.reset();
    expect(store.getSnapshot().events).toEqual([]);
    expect(store.getSnapshot().cards.size).toBe(0);
    expect(await allEvents(db)).toEqual([]);
  });

  it('keeps playing when the log cannot be read', async () => {
    const db = freshDb();
    db.close();
    const store = createProgressStore(() => db);
    await store.load();
    expect(store.getSnapshot().status).toBe('failed');
    store.record(answer('a1', 1));
    expect(store.getSnapshot().cards.size).toBe(1);
  });
});
