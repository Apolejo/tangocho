import { describe, expect, it } from 'vitest';
import {
  EMPTY_TALLY,
  accuracy,
  addAnswer,
  formatMultiplier,
  isPerfect,
  points,
  type Tally,
} from './score.ts';

const right = { correct: true, hinted: false };
const hinted = { correct: true, hinted: true };
const wrong = { correct: false, hinted: false };

const play = (answers: { correct: boolean; hinted: boolean }[]): Tally =>
  answers.reduce(addAnswer, EMPTY_TALLY);

describe('points', () => {
  it('grows by 10 per consecutive correct answer and stops at 200', () => {
    expect([0, 1, 2, 9, 10, 11, 50].map((streak) => points(streak, right))).toEqual([
      100, 110, 120, 190, 200, 200, 200,
    ]);
  });

  it('halves a hinted answer and gives nothing for a wrong one', () => {
    expect(points(0, hinted)).toBe(50);
    expect(points(3, hinted)).toBe(65);
    expect(points(5, wrong)).toBe(0);
  });
});

describe('addAnswer', () => {
  it('adds up a streak', () => {
    const t = play([right, right, right]);
    expect(t).toEqual({ score: 330, streak: 3, answered: 3, correct: 3, hinted: 0 });
  });

  it('reaches ×2.0 on the 11th consecutive answer', () => {
    const t = play(Array.from({ length: 12 }, () => right));
    // 100 + 110 + … + 190 = 1450, then 200 + 200
    expect(t.score).toBe(1850);
    expect(formatMultiplier(t.streak)).toBe('×2.0');
  });

  it('resets the combo on a wrong answer', () => {
    const t = play([right, right, wrong, right]);
    expect(t.score).toBe(100 + 110 + 0 + 100);
    expect(t.streak).toBe(1);
  });

  it('keeps the combo going through a hinted answer', () => {
    const t = play([right, hinted, right]);
    expect(t.score).toBe(100 + 55 + 120);
    expect(t.streak).toBe(3);
    expect(t.hinted).toBe(1);
  });
});

describe('accuracy and perfect rounds', () => {
  it('measures the share of correct answers', () => {
    expect(accuracy(EMPTY_TALLY)).toBe(0);
    expect(accuracy(play([right, wrong, right, wrong]))).toBe(0.5);
  });

  it('is perfect only with every answer right and no hints', () => {
    expect(isPerfect(EMPTY_TALLY)).toBe(false);
    expect(isPerfect(play([right, right]))).toBe(true);
    expect(isPerfect(play([right, hinted]))).toBe(false);
    expect(isPerfect(play([right, wrong]))).toBe(false);
  });

  it('formats the multiplier', () => {
    expect(formatMultiplier(0)).toBe('×1.0');
    expect(formatMultiplier(3)).toBe('×1.3');
  });
});
