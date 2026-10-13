import type { AnswerResult, Card } from '../games/types.ts';
import type { QueuedCard } from './queue.ts';
import { EMPTY_TALLY, addAnswer, points, type Tally } from './score.ts';

/**
 * The flow of one round as a pure reducer: question → feedback → next question … → done.
 * Round.tsx adds the timing, the logging and the screen.
 */

export interface AnswerRecord {
  card: Card;
  result: AnswerResult;
  points: number;
  ms: number;
}

export interface RoundState {
  queue: readonly QueuedCard[];
  index: number;
  phase: 'question' | 'feedback' | 'done';
  tally: Tally;
  answers: readonly AnswerRecord[];
}

export type RoundAction = { type: 'answer'; result: AnswerResult; ms: number } | { type: 'next' };

export function startRound(queue: readonly QueuedCard[]): RoundState {
  return {
    queue,
    index: 0,
    phase: queue.length === 0 ? 'done' : 'question',
    tally: EMPTY_TALLY,
    answers: [],
  };
}

export function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'answer': {
      // a question takes exactly one answer
      const current = state.queue[state.index];
      if (state.phase !== 'question' || current === undefined) return state;
      const record: AnswerRecord = {
        card: current.card,
        result: action.result,
        points: points(state.tally.streak, action.result),
        ms: action.ms,
      };
      return {
        ...state,
        phase: 'feedback',
        tally: addAnswer(state.tally, action.result),
        answers: [...state.answers, record],
      };
    }
    case 'next': {
      if (state.phase !== 'feedback') return state;
      const index = state.index + 1;
      return index >= state.queue.length
        ? { ...state, phase: 'done' }
        : { ...state, index, phase: 'question' };
    }
  }
}

export function isLastQuestion(state: RoundState): boolean {
  return state.index >= state.queue.length - 1;
}

/** Words answered wrong, each once, in the order they came up (the results list). */
export function missedWordIds(answers: readonly AnswerRecord[]): string[] {
  return [...new Set(missedCards(answers).map((card) => card.wordId))];
}

/**
 * The cards answered wrong, one per word, in the order they came up (for *Practice these*): each
 * keeps its skill and form, so a missed て form comes back as a て form.
 */
export function missedCards(answers: readonly AnswerRecord[]): Card[] {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const { card, result } of answers) {
    if (result.correct || seen.has(card.wordId)) continue;
    seen.add(card.wordId);
    cards.push(card);
  }
  return cards;
}
