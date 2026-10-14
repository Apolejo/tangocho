import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { allEvents, appendEvent, openProgressDb, type ProgressDb } from './db.ts';
import { answerEvent, roundEvent, type AnswerEvent, type ProgressEvent } from './events.ts';
import { createProgressStore } from './store.ts';
import { exportFileName, importProgressFile, parseProgressFile, progressFile } from './transfer.ts';

let opened: ProgressDb[] = [];

function freshDb(): ProgressDb {
  const db = openProgressDb(`transfer-${opened.length}-${Math.random()}`, {
    indexedDB,
    IDBKeyRange,
  });
  opened.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(opened.map((db) => db.delete()));
  opened = [];
});

const NOW = new Date(Date.UTC(2026, 9, 13, 12, 0));

const answer = (id: string, device: string, minutes: number, correct = true): AnswerEvent =>
  answerEvent(
    {
      roundId: `round-${device}`,
      game: 'quiz',
      wordId: 'taberu',
      skill: 'meaning',
      correct,
      hinted: false,
      ms: 1200,
      device,
    },
    id,
    new Date(NOW.getTime() + minutes * 60_000),
  );

const round = (device: string, minutes: number) =>
  roundEvent(
    {
      id: `round-${device}`,
      game: 'quiz',
      deckIds: ['all'],
      size: 10,
      variant: 'forward',
      practice: false,
      score: 200,
      correct: 2,
      total: 2,
    },
    new Date(NOW.getTime() + minutes * 60_000),
  );

const phoneLog: ProgressEvent[] = [
  answer('p1', 'phone', 0),
  answer('p2', 'phone', 1, false),
  round('phone', 1),
];
const computerLog: ProgressEvent[] = [answer('c1', 'computer', 30), round('computer', 30)];

const fileText = (events: readonly ProgressEvent[], device = 'phone') =>
  JSON.stringify(progressFile(events, device, NOW));

describe('progress files', () => {
  it('round-trips the events through export and parse', () => {
    const parsed = parseProgressFile(fileText(phoneLog));
    expect(parsed).toEqual({ ok: true, events: phoneLog, skipped: 0 });
  });

  it('names the file by the local date', () => {
    expect(exportFileName(new Date(2026, 9, 13, 23, 30))).toBe('tangocho-progress-2026-10-13.json');
  });

  it('refuses what is not a Tangochō export, or comes from a newer version', () => {
    expect(parseProgressFile('not json')).toEqual({ ok: false, reason: 'not-json' });
    expect(parseProgressFile('{"app":"other","version":1,"events":[]}')).toEqual({
      ok: false,
      reason: 'not-tangocho',
    });
    expect(parseProgressFile('[]')).toEqual({ ok: false, reason: 'not-tangocho' });
    expect(parseProgressFile('{"app":"tangocho","version":2,"events":[]}')).toEqual({
      ok: false,
      reason: 'newer-version',
    });
  });

  it('skips and counts invalid events, and keeps a repeated id once', () => {
    const good = answer('p1', 'phone', 0);
    const events: unknown[] = [
      good,
      { ...good }, // the same id again
      { ...answer('bad-at', 'phone', 0), at: '2026-10-13 12:00' },
      { ...answer('bad-game', 'phone', 0), game: 'chess' },
      { ...round('phone', 1), score: 'lots' },
      { type: 'note', id: 'n1' },
      'text',
    ];
    const parsed = parseProgressFile(
      JSON.stringify({ app: 'tangocho', version: 1, exportedAt: NOW.toISOString(), events }),
    );
    expect(parsed).toEqual({ ok: true, events: [good], skipped: 5 });
  });

  it('drops fields it does not know', () => {
    const extra = { ...answer('p1', 'phone', 0), mood: 'happy' };
    const parsed = parseProgressFile(fileText([extra as ProgressEvent]));
    expect(parsed.ok && parsed.events[0]).not.toHaveProperty('mood');
  });
});

describe('importing (SPEC §10.1)', () => {
  it('changes nothing when the same file is imported twice', async () => {
    const db = freshDb();
    const store = createProgressStore(() => db);
    await store.load();
    const text = fileText(phoneLog);

    expect(await importProgressFile(text, store)).toEqual({
      ok: true,
      added: 3,
      existing: 0,
      skipped: 0,
    });
    const once = store.getSnapshot();
    const rows = await allEvents(db);

    expect(await importProgressFile(text, store)).toEqual({
      ok: true,
      added: 0,
      existing: 3,
      skipped: 0,
    });
    expect(await allEvents(db)).toHaveLength(rows.length);
    expect(store.getSnapshot().events).toEqual(once.events);
    expect(store.getSnapshot().cards).toEqual(once.cards);
  });

  it("merges the phone's log into the computer's: the union of both", async () => {
    const db = freshDb();
    for (const e of computerLog) await appendEvent(e, db);
    const store = createProgressStore(() => db);
    await store.load();

    await importProgressFile(fileText(phoneLog), store);
    const ids = store
      .getSnapshot()
      .events.map((e) => e.id)
      .sort();
    expect(ids).toEqual([...phoneLog, ...computerLog].map((e) => e.id).sort());
    expect(await allEvents(db)).toHaveLength(phoneLog.length + computerLog.length);

    // the same state as one device that had every answer from the start
    const other = createProgressStore(() => freshDb());
    await other.load();
    await other.importEvents([...computerLog, ...phoneLog]);
    expect(store.getSnapshot().cards).toEqual(other.getSnapshot().cards);
  });

  it('keeps the local event when an imported one has the same id', async () => {
    const db = freshDb();
    const mine = answer('p1', 'phone', 0, true);
    await appendEvent(mine, db);
    const store = createProgressStore(() => db);
    await store.load();

    const result = await importProgressFile(fileText([{ ...mine, correct: false }]), store);
    expect(result).toEqual({ ok: true, added: 0, existing: 1, skipped: 0 });
    expect(await allEvents(db)).toEqual([mine]);
  });

  it('imports nothing from a file it refuses', async () => {
    const db = freshDb();
    const store = createProgressStore(() => db);
    await store.load();
    expect(await importProgressFile('{}', store)).toEqual({ ok: false, reason: 'not-tangocho' });
    expect(await allEvents(db)).toEqual([]);
  });
});
