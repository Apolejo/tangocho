/**
 * Round scoring (SPEC §10.3). A correct answer earns 100 × the combo multiplier, which starts at
 * ×1.0 and grows by 0.1 per consecutive correct answer up to ×2.0. A hinted answer earns half;
 * a wrong one earns nothing and resets the combo. Kept in integer points: 100, 110, … 200.
 */

export const BASE_POINTS = 100;
const STEP_POINTS = 10;
const MAX_STEPS = 10;

export interface Tally {
  score: number;
  /** Consecutive correct answers so far: the combo. */
  streak: number;
  answered: number;
  correct: number;
  hinted: number;
}

export const EMPTY_TALLY: Tally = { score: 0, streak: 0, answered: 0, correct: 0, hinted: 0 };

/** The multiplier the next correct answer gets, in tenths (10 = ×1.0, 20 = ×2.0). */
export function multiplierTenths(streak: number): number {
  return 10 + Math.min(streak, MAX_STEPS);
}

/** "×1.3" */
export function formatMultiplier(streak: number): string {
  return `×${(multiplierTenths(streak) / 10).toFixed(1)}`;
}

export function points(streak: number, answer: { correct: boolean; hinted: boolean }): number {
  if (!answer.correct) return 0;
  const full = BASE_POINTS + STEP_POINTS * Math.min(streak, MAX_STEPS);
  return answer.hinted ? full / 2 : full;
}

export function addAnswer(tally: Tally, answer: { correct: boolean; hinted: boolean }): Tally {
  return {
    score: tally.score + points(tally.streak, answer),
    streak: answer.correct ? tally.streak + 1 : 0,
    answered: tally.answered + 1,
    correct: tally.correct + (answer.correct ? 1 : 0),
    hinted: tally.hinted + (answer.correct && answer.hinted ? 1 : 0),
  };
}

/** Share of correct answers, 0 to 1. */
export function accuracy(tally: Tally): number {
  return tally.answered === 0 ? 0 : tally.correct / tally.answered;
}

/** Every answer right without a hint: earns the 花丸 (SPEC §7.5). */
export function isPerfect(tally: Tally): boolean {
  return tally.answered > 0 && tally.correct === tally.answered && tally.hinted === 0;
}
