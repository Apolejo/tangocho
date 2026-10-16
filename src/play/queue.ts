import type { Word } from '../data/schema.ts';
import type { Card, Minigame, RoundOptions, Skill } from '../games/types.ts';
import { nextSeed, shuffle, weightedPick, type Rng } from '../lib/random.ts';
import { formWeight, type FormStats } from '../progress/forms.ts';
import { cardKey, isDue, weakness, type CardState, type CardStates } from '../progress/srs.ts';

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
}

/** A card answered this recently waits unless it's due: a right answer minutes ago says little more. */
export const REST_MS = 60 * 60_000;

/** The share of a round kept for the draw while there is anything to draw: 3 of 10, 6 of 20. */
export const DRAW_SHARE = 0.3;

/** The queue's tiers (SPEC §10.2): due cards, then the draw, then the cards that wait. */
type Tier = 0 | 1 | 2;

interface Candidate {
  word: Word;
  skill: Skill;
  state: CardState | undefined;
  tier: Tier;
  weakness: number;
}

/** Without `srs` every card is new, and in the draw. */
function tierOf(state: CardState | undefined, srs: QueueSrs | undefined): Tier {
  if (state === undefined || srs === undefined) return 1;
  if (isDue(state, srs.now)) return 0;
  const rested = srs.now.getTime() - Date.parse(state.lastAt) >= REST_MS;
  return state.fsrs.scheduled_days >= 1 && rested ? 1 : 2;
}

const FAR = Number.MAX_SAFE_INTEGER;

/** The earlier tier first, then the weaker card, then the one due sooner; ties keep their order. */
function byPriority(a: Candidate, b: Candidate): number {
  return (
    a.tier - b.tier ||
    b.weakness - a.weakness ||
    (a.state?.fsrs.due.getTime() ?? FAR) - (b.state?.fsrs.due.getTime() ?? FAR)
  );
}

/**
 * The round queue (SPEC §10.2): each word at most once, with one of the skills the options ask
 * for. Due cards come first, the weakest first and then the most overdue, up to all but the
 * draw's share of the round. Then a draw fills the round from the new cards and the cards
 * scheduled in days that aren't due and have rested, each as likely as its weakness, so new words
 * keep coming and the words missed lately come more often. Then, only if the round still isn't
 * full, the due cards left over, then the cards that waited, the weakest first. The chosen
 * cards are shuffled. A word with several cards (the quiz's mixed mode) gives the one that comes
 * first. A game whose cards have a form (the drill) gets one per card, drawn with the forms missed
 * more often weighing more (SPEC §9.4). Without `srs` every card is new.
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
  const tiers: [Candidate[], Candidate[], Candidate[]] = [[], [], []];
  for (const word of shuffle(pool, rng)) {
    let best: Candidate | undefined;
    for (const skill of shuffle(
      skills.filter((s) => game.eligible(word, s)),
      rng,
    )) {
      const state = srs?.cards.get(cardKey(word.id, skill));
      const candidate: Candidate = {
        word,
        skill,
        state,
        tier: tierOf(state, srs),
        weakness: weakness(state),
      };
      if (best === undefined || byPriority(candidate, best) < 0) best = candidate;
    }
    if (best !== undefined) tiers[best.tier].push(best);
  }
  const [due, draw, waiting] = tiers;

  const picked: Card[] = [];
  const full = (): boolean => picked.length >= size;
  const take = ({ word, skill }: Candidate): void => {
    let form: string | undefined;
    if (game.formsFor !== undefined) {
      form = weightedPick(game.formsFor(word, options), (f) => formWeight(formStats?.get(f)), rng);
      if (form === undefined) return;
    }
    picked.push({ wordId: word.id, skill, ...(form !== undefined && { form }) });
  };

  const dueFirst = size - Math.min(Math.floor(size * DRAW_SHARE), draw.length);
  const dueLater: Candidate[] = [];
  for (const c of due.sort(byPriority)) {
    if (picked.length >= dueFirst) dueLater.push(c);
    else take(c);
  }
  const left = [...draw];
  while (!full() && left.length > 0) {
    const c = weightedPick(left, (x) => x.weakness, rng);
    if (c === undefined) break;
    left.splice(left.indexOf(c), 1);
    take(c);
  }
  for (const c of [...dueLater, ...waiting.sort(byPriority)]) {
    if (full()) break;
    take(c);
  }

  return shuffle(picked, rng).map((card) => ({ card, seed: nextSeed(rng) }));
}

/** A *Practice these* round: the missed cards again, each with its skill and form, shuffled. */
export function practiceQueue(cards: readonly Card[], rng: Rng): QueuedCard[] {
  return shuffle(cards, rng).map((card) => ({ card, seed: nextSeed(rng) }));
}
