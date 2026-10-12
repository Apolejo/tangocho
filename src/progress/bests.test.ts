import { describe, expect, it } from 'vitest';
import { bestKey, isNewRecord, personalBest } from './bests.ts';
import { roundEvent, type RoundEvent } from './events.ts';

const round = (id: string, score: number, over: Partial<RoundEvent> = {}): RoundEvent =>
  roundEvent(
    {
      id,
      game: 'quiz',
      deckIds: ['verbs-g1', 'occupations'],
      size: 10,
      variant: 'forward',
      practice: false,
      score,
      correct: 0,
      total: 10,
      ...over,
    },
    new Date('2026-10-10T12:00:00Z'),
  );

const key = bestKey('quiz', ['occupations', 'verbs-g1'], 10, 'forward');

describe('bestKey', () => {
  it('ignores the order of the decks', () => {
    expect(bestKey('quiz', ['verbs-g1', 'occupations'], 10, 'forward')).toBe(key);
  });

  it('separates games, sizes and variants', () => {
    const keys = [
      key,
      bestKey('sorter', ['occupations', 'verbs-g1'], 10, 'forward'),
      bestKey('quiz', ['occupations', 'verbs-g1'], 20, 'forward'),
      bestKey('quiz', ['occupations', 'verbs-g1'], 10, 'reverse'),
      bestKey('quiz', ['occupations'], 10, 'forward'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('personalBest', () => {
  it('is the highest score for the key', () => {
    expect(personalBest([round('a', 800), round('b', 1200), round('c', 950)], key)).toBe(1200);
  });

  it('is undefined with no rounds for the key', () => {
    expect(personalBest([], key)).toBeUndefined();
    expect(personalBest([round('a', 800, { variant: 'reverse' })], key)).toBeUndefined();
  });

  it('ignores other sizes, variants, deck selections and practice rounds', () => {
    const rounds = [
      round('a', 500),
      round('b', 2000, { size: 20 }),
      round('c', 2000, { variant: 'mixed' }),
      round('d', 2000, { deckIds: ['verbs-g1'] }),
      round('e', 2000, { practice: true }),
    ];
    expect(personalBest(rounds, key)).toBe(500);
  });

  it('can leave out the round just played', () => {
    expect(personalBest([round('a', 500), round('b', 900)], key, 'b')).toBe(500);
    expect(personalBest([round('b', 900)], key, 'b')).toBeUndefined();
  });
});

describe('isNewRecord', () => {
  it('needs to beat the previous best', () => {
    expect(isNewRecord(1000, 900)).toBe(true);
    expect(isNewRecord(900, 900)).toBe(false);
    expect(isNewRecord(800, 900)).toBe(false);
  });

  it('counts the first round for a key when it scored', () => {
    expect(isNewRecord(100, undefined)).toBe(true);
    expect(isNewRecord(0, undefined)).toBe(false);
  });
});
