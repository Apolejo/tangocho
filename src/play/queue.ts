import type { Word } from '../data/schema.ts';
import type { Card, Minigame, RoundOptions } from '../games/types.ts';
import { nextSeed, pick, shuffle, weightedPick, type Rng } from '../lib/random.ts';
import { formWeight, type FormStats } from '../progress/forms.ts';

/** A card in the round plus the seed for its question's own randomness. */
export interface QueuedCard {
  card: Card;
  seed: number;
}

export const ROUND_SIZES = [10, 20] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];

/**
 * The round queue, shuffled for now: each word at most once, with one of the skills the options
 * ask for. A game whose cards have a form (the conjugation drill) gets one per card, drawn with
 * the forms missed more often weighing more (SPEC §9.4). The spaced-repetition order (SPEC §10.2)
 * replaces the shuffle in M8.
 */
export function buildQueue({
  pool,
  game,
  options,
  size,
  rng,
  formStats,
}: {
  pool: readonly Word[];
  game: Pick<Minigame, 'skillsFor' | 'eligible' | 'formsFor'>;
  options: RoundOptions;
  size: number;
  rng: Rng;
  /** Misses per form from the log; without it every form weighs the same. */
  formStats?: FormStats;
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
    let form: string | undefined;
    if (game.formsFor !== undefined) {
      form = weightedPick(game.formsFor(word, options), (f) => formWeight(formStats?.get(f)), rng);
      if (form === undefined) continue;
    }
    const card: Card = { wordId: word.id, skill, ...(form !== undefined && { form }) };
    queue.push({ card, seed: nextSeed(rng) });
  }
  return queue;
}

/** A *Practice these* round: the missed cards again, each with its skill and form, shuffled. */
export function practiceQueue(cards: readonly Card[], rng: Rng): QueuedCard[] {
  return shuffle(cards, rng).map((card) => ({ card, seed: nextSeed(rng) }));
}
