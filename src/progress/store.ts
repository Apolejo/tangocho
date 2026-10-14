import { allEvents, appendEvent, clearEvents, importEvents, type ProgressDb } from './db.ts';
import type { AnswerEvent, ProgressEvent, RoundEvent } from './events.ts';
import { requestPersistence } from './persist.ts';
import { byEventOrder, cardKey, replay, review, type CardStates } from './srs.ts';

/**
 * The progress log in memory, and the state derived from it (SPEC §10.1): loaded once, rebuilt
 * after an import or a reset, kept current as answers come in. The log in IndexedDB stays the
 * source of truth; nothing derived is stored. Read in React through useSyncExternalStore.
 */

export interface ProgressSnapshot {
  /** 'failed': the log couldn't be read; play goes on, with every card new. */
  status: 'loading' | 'ready' | 'failed';
  /** The whole log in its order (time, then id). */
  events: readonly ProgressEvent[];
  answers: readonly AnswerEvent[];
  rounds: readonly RoundEvent[];
  /** Every card's spaced-repetition state. */
  cards: CardStates;
}

export interface ImportResult {
  added: number;
  existing: number;
}

export interface ProgressStore {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): ProgressSnapshot;
  /** Loads the log once; later calls return the same promise. */
  load(): Promise<ProgressSnapshot>;
  /** Appends an event: in memory at once, then to IndexedDB. An id already here is ignored. */
  record(event: ProgressEvent): void;
  /** Merges events by id into the log and rebuilds. */
  importEvents(events: readonly ProgressEvent[]): Promise<ImportResult>;
  /** Deletes the whole log. */
  reset(): Promise<void>;
}

const isAnswer = (e: ProgressEvent): e is AnswerEvent => e.type === 'answer';
const isRound = (e: ProgressEvent): e is RoundEvent => e.type === 'round';

/** A copy of a list in log order with one more item, placed by its time. */
function inserted<T extends ProgressEvent>(list: readonly T[], event: T): T[] {
  const last = list.at(-1);
  if (last === undefined || byEventOrder(last, event) <= 0) return [...list, event];
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (byEventOrder(list[mid] as T, event) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return [...list.slice(0, lo), event, ...list.slice(lo)];
}

function snapshotOf(status: ProgressSnapshot['status'], events: ProgressEvent[]): ProgressSnapshot {
  const sorted = [...events].sort(byEventOrder);
  const answers = sorted.filter(isAnswer);
  return {
    status,
    events: sorted,
    answers,
    rounds: sorted.filter(isRound),
    cards: replay(answers),
  };
}

/** `db` lets tests pass an in-memory database; the app uses the shared one. */
export function createProgressStore(db?: () => ProgressDb): ProgressStore {
  const database = () => db?.();
  let snapshot: ProgressSnapshot = snapshotOf('loading', []);
  let ids = new Set<string>();
  let loading: Promise<ProgressSnapshot> | undefined;
  const listeners = new Set<() => void>();

  const publish = (next: ProgressSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const rebuild = (status: ProgressSnapshot['status'], events: ProgressEvent[]) => {
    ids = new Set(events.map((e) => e.id));
    publish(snapshotOf(status, events));
  };

  const load = () => {
    // a database that fails to open, even at once, still lets play go on
    loading ??= Promise.resolve()
      .then(() => allEvents(database()))
      .then(
        (stored) => {
          // answers recorded while loading may or may not be in what was read: merge by id
          const byId = new Map(stored.map((e) => [e.id, e]));
          for (const e of snapshot.events) if (!byId.has(e.id)) byId.set(e.id, e);
          rebuild('ready', [...byId.values()]);
          if (snapshot.events.length > 0) void requestPersistence();
          return snapshot;
        },
        (error: unknown) => {
          console.warn('could not read progress', error);
          publish({ ...snapshot, status: 'failed' });
          return snapshot;
        },
      );
    return loading;
  };

  const record = (event: ProgressEvent) => {
    if (ids.has(event.id)) return;
    ids.add(event.id);
    const events = inserted(snapshot.events, event);
    if (isRound(event)) {
      publish({ ...snapshot, events, rounds: inserted(snapshot.rounds, event) });
      void requestPersistence();
    } else {
      const answers = inserted(snapshot.answers, event);
      const key = cardKey(event.wordId, event.skill);
      const before = snapshot.cards.get(key);
      // an answer older than the card's latest (another device's clock) replays the card
      const card =
        before === undefined || before.lastAt <= event.at
          ? review(before, event)
          : replay(answers.filter((a) => cardKey(a.wordId, a.skill) === key)).get(key);
      const cards = new Map(snapshot.cards);
      if (card !== undefined) cards.set(key, card);
      publish({ ...snapshot, events, answers, cards });
    }
    Promise.resolve()
      .then(() => appendEvent(event, database()))
      .catch((error: unknown) => console.warn('could not save progress', error));
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => snapshot,
    load,
    record,
    async importEvents(events) {
      await load();
      const { added, existing } = await importEvents(events, database());
      const fresh = added.filter((e) => !ids.has(e.id));
      if (fresh.length > 0) rebuild(snapshot.status, [...snapshot.events, ...fresh]);
      return { added: added.length, existing };
    },
    async reset() {
      await load();
      await clearEvents(database());
      rebuild(snapshot.status === 'failed' ? 'ready' : snapshot.status, []);
    },
  };
}

/** The app's progress. */
export const progress: ProgressStore = createProgressStore();
