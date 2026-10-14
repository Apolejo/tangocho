import type { Word } from '../data/schema.ts';
import type { Card, Minigame, RoundOptions, Skill } from '../games/types.ts';
import { nextSeed, shuffle, weightedPick, type Rng } from '../lib/random.ts';
import { formWeight, type FormStats } from '../progress/forms.ts';
import { cardKey, isDue, type CardState, type CardStates } from '../progress/srs.ts';

/** A card in the round plus the seed for its question's own randomness. */
export interface QueuedCard {
  card: Card;
  seed: number;
}

export const ROUND_SIZES = [10, 20] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];

/** What the queue needs from the log (SPEC §10.2). */
export interface QueueSrs {
  cards: CardStates;
  now: Date;
  /** New cards still allowed today (the daily limit minus the cards first answered today). */
  newLeft: number;
}

interface Candidate {
  word: Word;
  skill: Skill;
  state: CardState | undefined;
}

/**
 * The round queue (SPEC §10.2): each word at most once, with one of the skills the options ask
 * for. Due cards come first, the most overdue first; then new cards up to today's limit; then the
 * least recently seen cards; then, only if the round still isn't full, new cards past the limit.
 * The chosen cards are shuffled. A word with several cards (the quiz's mixed mode) gives the one
 * that comes first. A game whose cards have a form (the drill) gets one per card, drawn with the
 * forms missed more often weighing more (SPEC §9.4). Without `srs` every card is new.
 */
export function buildQueue({
  pool,
  game,
  options,
  size,
  rng,
  formStats,
  srs,
}: {
  pool: readonly Word[];
  game: Pick<Minigame, 'skillsFor' | 'eligible' | 'formsFor'>;
  options: RoundOptions;
  size: number;
  rng: Rng;
  /** Misses per form from the log; without it every form weighs the same. */
  formStats?: FormStats;
  /** The cards' spaced-repetition state; without it every card is new. */
  srs?: QueueSrs;
}): QueuedCard[] {
  const skills = game.skillsFor(options);
  const due: (Candidate & { state: CardState })[] = [];
  const fresh: Candidate[] = [];
  const seen: (Candidate & { state: CardState })[] = [];
  for (const word of shuffle(pool, rng)) {
    for (const skill of shuffle(
      skills.filter((s) => game.eligible(word, s)),
      rng,
    )) {
      const state = srs?.cards.get(cardKey(word.id, skill));
      if (state === undefined) fresh.push({ word, skill, state });
      else if (srs !== undefined && isDue(state, srs.now)) due.push({ word, skill, state });
      else seen.push({ word, skill, state });
    }
  }
  // stable sorts: ties keep the shuffled order
  due.sort((a, b) => a.state.fsrs.due.getTime() - b.state.fsrs.due.getTime());
  seen.sort((a, b) =>
    a.state.lastAt < b.state.lastAt ? -1 : a.state.lastAt > b.state.lastAt ? 1 : 0,
  );

  const picked: Card[] = [];
  const used = new Set<string>();
  const take = ({ word, skill }: Candidate): boolean => {
    if (picked.length >= size || used.has(word.id)) return false;
    let form: string | undefined;
    if (game.formsFor !== undefined) {
      form = weightedPick(game.formsFor(word, options), (f) => formWeight(formStats?.get(f)), rng);
      if (form === undefined) return false;
    }
    used.add(word.id);
    picked.push({ wordId: word.id, skill, ...(form !== undefined && { form }) });
    return true;
  };

  for (const c of due) take(c);
  const newLeft = srs?.newLeft ?? Infinity;
  let newTaken = 0;
  const pastLimit: Candidate[] = [];
  for (const c of fresh) {
    if (newTaken >= newLeft) pastLimit.push(c);
    else if (take(c)) newTaken++;
  }
  for (const c of seen) take(c);
  for (const c of pastLimit) take(c);

  return shuffle(picked, rng).map((card) => ({ card, seed: nextSeed(rng) }));
}

/** A *Practice these* round: the missed cards again, each with its skill and form, shuffled. */
export function practiceQueue(cards: readonly Card[], rng: Rng): QueuedCard[] {
  return shuffle(cards, rng).map((card) => ({ card, seed: nextSeed(rng) }));
}
