import type { Word } from '../data/schema.ts';
import type { Card, GameId, Minigame, RoundOptions } from '../games/types.ts';
import type { Rng } from '../lib/random.ts';
import type { FormStats } from '../progress/forms.ts';
import { buildQueue, practiceQueue, type QueuedCard } from './queue.ts';

/** Everything a round needs, fixed when it starts. */
export interface RoundPlan {
  /** Also the id of the round's RoundEvent, which its answer events point to. */
  id: string;
  game: GameId;
  deckIds: readonly string[];
  /** The size chosen on setup; a practice round's size is its number of cards. */
  size: number;
  options: RoundOptions;
  /** Every eligible word of the selected decks, for distractors. */
  pool: readonly Word[];
  queue: readonly QueuedCard[];
  /** A *Practice these* round over missed cards: never a personal best. */
  practice: boolean;
}

/** The words a round with these options can ask about (the quiz takes every word, the sorter verbs). */
export function eligibleWords(
  game: Pick<Minigame, 'skillsFor' | 'eligible'>,
  options: RoundOptions,
  words: readonly Word[],
): Word[] {
  const skills = game.skillsFor(options);
  return words.filter((w) => skills.some((s) => game.eligible(w, s)));
}

export function planRound({
  id,
  game,
  deckIds,
  size,
  options,
  words,
  only,
  formStats,
  rng,
}: {
  id: string;
  game: Pick<Minigame, 'id' | 'skillsFor' | 'eligible' | 'formsFor'>;
  deckIds: readonly string[];
  size: number;
  options: RoundOptions;
  /** The words of the selected decks. */
  words: readonly Word[];
  /** Practice: just these cards (the missed ones), each with its skill and form. */
  only?: readonly Card[];
  /** Misses per form, for a game whose cards have one. */
  formStats?: FormStats;
  rng: Rng;
}): RoundPlan {
  const pool = eligibleWords(game, options, words);
  const practice = only !== undefined;
  const queue =
    only === undefined
      ? buildQueue({ pool, game, options, size, rng, formStats })
      : practiceQueue(only, rng);
  return {
    id,
    game: game.id,
    deckIds,
    size: practice ? queue.length : size,
    options,
    pool,
    queue,
    practice,
  };
}
