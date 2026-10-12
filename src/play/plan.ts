import type { Word } from '../data/schema.ts';
import type { GameId, Minigame, RoundOptions } from '../games/types.ts';
import type { Rng } from '../lib/random.ts';
import { buildQueue, type QueuedCard } from './queue.ts';

/** Everything a round needs, fixed when it starts. */
export interface RoundPlan {
  /** Also the id of the round's RoundEvent, which its answer events point to. */
  id: string;
  game: GameId;
  deckIds: readonly string[];
  /** The size chosen on setup; a practice round's size is its number of words. */
  size: number;
  options: RoundOptions;
  /** Every eligible word of the selected decks, for distractors. */
  pool: readonly Word[];
  queue: readonly QueuedCard[];
  /** A *Practice these* round over missed words: never a personal best. */
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
  rng,
}: {
  id: string;
  game: Pick<Minigame, 'id' | 'skillsFor' | 'eligible'>;
  deckIds: readonly string[];
  size: number;
  options: RoundOptions;
  /** The words of the selected decks. */
  words: readonly Word[];
  /** Practice: just these words (the missed ones). */
  only?: readonly Word[];
  rng: Rng;
}): RoundPlan {
  const pool = eligibleWords(game, options, words);
  const practice = only !== undefined;
  const queue = buildQueue({
    pool: only ?? pool,
    game,
    options,
    size: only?.length ?? size,
    rng,
  });
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
