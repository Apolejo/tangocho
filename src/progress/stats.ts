import type { Word } from '../data/schema.ts';
import type { Card, Minigame } from '../games/types.ts';
import type { AnswerEvent } from './events.ts';
import { recentMisses, type CardStates } from './srs.ts';

/**
 * The Stats screen's numbers (SPEC §7.6, §10.5), from the log. Words no longer in the data are
 * left out, and so are cards a game no longer accepts. Pure.
 */

export interface Accuracy {
  correct: number;
  total: number;
}

const empty = (): Accuracy => ({ correct: 0, total: 0 });

const add = (acc: Accuracy, correct: boolean) => {
  acc.total++;
  if (correct) acc.correct++;
};

export type VerbGroup = 1 | 2 | 3;
export const VERB_GROUPS: readonly VerbGroup[] = [1, 2, 3];

export interface GroupAccuracy {
  /** Sorting the verb into its group (the sorter). */
  sorter: Accuracy;
  /** Conjugating it (the drill). */
  drill: Accuracy;
}

/** Accuracy per verb group, in the sorter and in the drill. */
export function accuracyByGroup(
  answers: readonly AnswerEvent[],
  wordsById: ReadonlyMap<string, Word>,
): Record<VerbGroup, GroupAccuracy> {
  const result = {
    1: { sorter: empty(), drill: empty() },
    2: { sorter: empty(), drill: empty() },
    3: { sorter: empty(), drill: empty() },
  };
  for (const answer of answers) {
    const group = wordsById.get(answer.wordId)?.verbGroup;
    if (group === undefined) continue;
    if (answer.skill === 'group') add(result[group].sorter, answer.correct);
    else if (answer.skill === 'conjugation') add(result[group].drill, answer.correct);
  }
  return result;
}

/** Accuracy per conjugation form, in the drill. */
export function accuracyByForm(
  answers: readonly AnswerEvent[],
  wordsById: ReadonlyMap<string, Word>,
): Map<string, Accuracy> {
  const result = new Map<string, Accuracy>();
  for (const answer of answers) {
    if (answer.skill !== 'conjugation' || answer.form === undefined) continue;
    if (!wordsById.has(answer.wordId)) continue;
    const acc = result.get(answer.form) ?? empty();
    add(acc, answer.correct);
    result.set(answer.form, acc);
  }
  return result;
}

export interface WeakCard {
  card: Card;
  word: Word;
  /** Misses among the card's latest answers. */
  misses: number;
  /** How many latest answers those misses are out of. */
  answers: number;
}

export const WEAKEST_COUNT = 10;

/**
 * A game's weakest cards: the most misses among each card's latest answers, ties to the lower
 * stability. A card with no recent miss isn't weak, so a word drops off once it's right again.
 */
export function weakestCards(
  cards: CardStates,
  game: Pick<Minigame, 'skills' | 'eligible'>,
  wordsById: ReadonlyMap<string, Word>,
  limit = WEAKEST_COUNT,
): WeakCard[] {
  const weak: (WeakCard & { stability: number })[] = [];
  for (const state of cards.values()) {
    if (!game.skills.includes(state.skill)) continue;
    const word = wordsById.get(state.wordId);
    if (word === undefined || !game.eligible(word, state.skill)) continue;
    const misses = recentMisses(state);
    if (misses === 0) continue;
    weak.push({
      card: { wordId: state.wordId, skill: state.skill },
      word,
      misses,
      answers: state.recent.length,
      stability: state.fsrs.stability,
    });
  }
  weak.sort(
    (a, b) =>
      b.misses - a.misses ||
      a.stability - b.stability ||
      (a.card.wordId < b.card.wordId ? -1 : a.card.wordId > b.card.wordId ? 1 : 0) ||
      (a.card.skill < b.card.skill ? -1 : a.card.skill > b.card.skill ? 1 : 0),
  );
  return weak
    .slice(0, limit)
    .map(({ card, word, misses, answers }) => ({ card, word, misses, answers }));
}
