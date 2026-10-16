import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import type { Skill } from '../games/types.ts';
import { addDays, dayKey } from './day.ts';
import type { AnswerEvent } from './events.ts';
import { RECENT_ANSWERS } from './forms.ts';

/**
 * Spaced repetition (SPEC §10.2): every card's FSRS state, replayed from the answer log. Pure.
 *
 * Default parameters, with fuzz off, so the same log gives the same state on every device: after
 * an import, phone and computer agree. ts-fsrs decides "same day" by UTC dates, not by our 04:00
 * day; it only shapes the short-term stability, and both devices replay it the same way.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export type { FsrsCard };

/** A card's spaced-repetition state, and what the stats need about its answers. */
export interface CardState {
  wordId: string;
  skill: Skill;
  fsrs: FsrsCard;
  /** ISO timestamps of the first and the latest answer. */
  firstAt: string;
  lastAt: string;
  answers: number;
  misses: number;
  /** The latest RECENT_ANSWERS answers, oldest first: true when right. */
  recent: readonly boolean[];
}

export type CardStates = ReadonlyMap<string, CardState>;

/** A card is a (word, skill) pair (SPEC §8.1); the conjugation form isn't part of it. */
export function cardKey(wordId: string, skill: Skill): string {
  return `${wordId}|${skill}`;
}

/** Answer → rating: wrong → Again, right with a hint → Hard, right → Good. Never Easy. */
export function rating(answer: Pick<AnswerEvent, 'correct' | 'hinted'>): Grade {
  if (!answer.correct) return Rating.Again;
  return answer.hinted ? Rating.Hard : Rating.Good;
}

/** The log's order: by time, then by id, so the replay doesn't depend on how events arrived. */
export function byEventOrder(a: { at: string; id: string }, b: { at: string; id: string }): number {
  // ISO timestamps in UTC sort as text
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** One answer applied to its card's state (undefined for a card never answered). */
export function review(state: CardState | undefined, answer: AnswerEvent): CardState {
  const at = new Date(answer.at);
  const card: FsrsCard = state?.fsrs ?? createEmptyCard<FsrsCard>(at);
  return {
    wordId: answer.wordId,
    skill: answer.skill,
    fsrs: scheduler.next(card, at, rating(answer)).card,
    firstAt: state?.firstAt ?? answer.at,
    lastAt: answer.at,
    answers: (state?.answers ?? 0) + 1,
    misses: (state?.misses ?? 0) + (answer.correct ? 0 : 1),
    recent: [...(state?.recent ?? []), answer.correct].slice(-RECENT_ANSWERS),
  };
}

/** Every card's state from the answers, in any order. */
export function replay(answers: readonly AnswerEvent[]): Map<string, CardState> {
  const cards = new Map<string, CardState>();
  for (const answer of [...answers].sort(byEventOrder)) {
    const key = cardKey(answer.wordId, answer.skill);
    cards.set(key, review(cards.get(key), answer));
  }
  return cards;
}

/**
 * Whether a card is due. A card scheduled in days is due from the start (04:00) of its due day,
 * so a word due "tomorrow" is ready in the morning, not at the hour I last answered it; a card in
 * a learning step (minutes) is due at its exact time.
 */
export function isDue(state: CardState, now: Date): boolean {
  const { scheduled_days: days, last_review: last, due } = state.fsrs;
  if (days >= 1 && last !== undefined) return addDays(dayKey(last), days) <= dayKey(now);
  return due.getTime() <= now.getTime();
}

/** Each answer weighs this much of the one after it in a card's weakness. */
export const ANSWER_DECAY = 0.8;

/**
 * How likely a card is to be missed (SPEC §10.2), from its latest answers with the latest counting
 * most: each weighs ANSWER_DECAY times the one after it, and one virtual miss and one virtual hit
 * stand for what isn't known yet. A card never seen is 0.5; right once, 1/3, so one right answer
 * is never taken for granted; right ten times in a row, about 0.15; wrong once, 2/3. The queue
 * draws by it, and Stats ranks the weakest words by it (§10.5).
 */
export function weakness(state: Pick<CardState, 'recent'> | undefined): number {
  let answers = 0;
  let misses = 0;
  let weight = 1;
  const recent = state?.recent ?? [];
  for (let i = recent.length - 1; i >= 0; i--, weight *= ANSWER_DECAY) {
    answers += weight;
    if (!recent[i]) misses += weight;
  }
  return (1 + misses) / (2 + answers);
}

/** Misses among the card's latest answers. */
export function recentMisses(state: CardState): number {
  return state.recent.filter((right) => !right).length;
}
