import type { Word } from '../data/schema.ts';
import type { Card, GameId, Minigame, RoundOptions } from '../games/types.ts';
import { weightedPick, type Rng } from '../lib/random.ts';
import { formWeight, type FormStats } from '../progress/forms.ts';
import { buildQueue, practiceQueue, type QueuedCard, type QueueSrs } from './queue.ts';

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
  srs,
  rng,
}: {
  id: string;
  game: Pick<Minigame, 'id' | 'skillsFor' | 'eligible' | 'formsFor'>;
  deckIds: readonly string[];
  size: number;
  options: RoundOptions;
  /** The words of the selected decks. */
  words: readonly Word[];
  /**
   * Practice: just these cards (the missed ones, or the weakest from Stats), each with its skill
   * and form. A card without a form, in a game whose cards have one, gets one drawn; a card
   * whose word isn't in `words` is dropped.
   */
  only?: readonly Card[];
  /** Misses per form, for a game whose cards have one. */
  formStats?: FormStats;
  /** The cards' spaced-repetition state (SPEC §10.2); without it every card is new. */
  srs?: QueueSrs;
  rng: Rng;
}): RoundPlan {
  const pool = eligibleWords(game, options, words);
  const practice = only !== undefined;
  const queue =
    only === undefined
      ? buildQueue({ pool, game, options, size, rng, formStats, srs })
      : practiceQueue(withForms(only, game, options, words, formStats, rng), rng);
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

/** Practice cards ready to ask: a form drawn for each card that needs one and has none. */
function withForms(
  cards: readonly Card[],
  game: Pick<Minigame, 'formsFor'>,
  options: RoundOptions,
  words: readonly Word[],
  formStats: FormStats | undefined,
  rng: Rng,
): Card[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  return cards.flatMap((card) => {
    const word = byId.get(card.wordId);
    if (word === undefined) return [];
    if (game.formsFor === undefined || card.form !== undefined) return [card];
    const form = weightedPick(
      game.formsFor(word, options),
      (f) => formWeight(formStats?.get(f)),
      rng,
    );
    return form === undefined ? [] : [{ ...card, form }];
  });
}
