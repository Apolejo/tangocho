import type { Word } from '../data/schema.ts';
import type { Card, Minigame, RoundOptions } from '../games/types.ts';
import { nextSeed, pick, shuffle, type Rng } from '../lib/random.ts';

/** A card in the round plus the seed for its question's own randomness. */
export interface QueuedCard {
  card: Card;
  seed: number;
}

export const ROUND_SIZES = [10, 20] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];

/**
 * The round queue, shuffled for now: each word at most once, with one of the skills the options
 * ask for. The spaced-repetition order (SPEC §10.2) replaces this in M8.
 */
export function buildQueue({
  pool,
  game,
  options,
  size,
  rng,
}: {
  pool: readonly Word[];
  game: Pick<Minigame, 'skillsFor' | 'eligible'>;
  options: RoundOptions;
  size: number;
  rng: Rng;
}): QueuedCard[] {
  const skills = game.skillsFor(options);
  const queue: QueuedCard[] = [];
  for (const word of shuffle(pool, rng)) {
    if (queue.length >= size) break;
    const skill = pick(
      skills.filter((s) => game.eligible(word, s)),
      rng,
    );
    if (skill === undefined) continue;
    queue.push({ card: { wordId: word.id, skill }, seed: nextSeed(rng) });
  }
  return queue;
}
