import type { GameId, Skill } from '../games/types.ts';

/**
 * The progress log (SPEC §10.1): append-only events in IndexedDB. Scores, personal bests and
 * (from M8) spaced-repetition state are derived from these, never stored on their own.
 */

/** One answer to one card. */
export interface AnswerEvent {
  type: 'answer';
  id: string;
  /** ISO timestamp. */
  at: string;
  /** The id of the round's RoundEvent. */
  roundId: string;
  game: GameId;
  wordId: string;
  skill: Skill;
  form?: string;
  correct: boolean;
  hinted: boolean;
  /** Time from showing the question to the answer. */
  ms: number;
  /** Which install wrote it (export/import merges phone and computer). */
  device: string;
}

/** One finished round. */
export interface RoundEvent {
  type: 'round';
  id: string;
  at: string;
  game: GameId;
  /** The selected decks, sorted. */
  deckIds: string[];
  /** The round size chosen on setup (10 or 20), even when the pool was smaller. */
  size: number;
  /** The game's part of the personal-best key, e.g. the quiz direction (SPEC §10.3). */
  variant: string;
  /** A *Practice these* round: logged, but never a personal best. */
  practice: boolean;
  score: number;
  correct: number;
  total: number;
}

export type ProgressEvent = AnswerEvent | RoundEvent;

export function answerEvent(
  fields: Omit<AnswerEvent, 'type' | 'id' | 'at'>,
  id: string,
  at: Date,
): AnswerEvent {
  return { type: 'answer', id, at: at.toISOString(), ...fields };
}

export function roundEvent(fields: Omit<RoundEvent, 'type' | 'at'>, at: Date): RoundEvent {
  return {
    ...fields,
    type: 'round',
    at: at.toISOString(),
    deckIds: [...fields.deckIds].sort(),
  };
}
