import { describe, expect, it } from 'vitest';
import { mulberry32, newId, nextSeed, pick, randomSeed, shuffle, weightedPick } from './random.ts';

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, mulberry32(43))).not.toEqual(seqA);
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(items, mulberry32(1));
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
  });

  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(9))).toEqual(
      shuffle([1, 2, 3, 4, 5], mulberry32(9)),
    );
  });

  it('handles empty and single lists', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle(['a'], mulberry32(1))).toEqual(['a']);
  });
});

describe('pick and seeds', () => {
  it('picks an element, or undefined from nothing', () => {
    expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c'], mulberry32(3)));
    expect(pick([], mulberry32(3))).toBeUndefined();
  });

  it('makes 32-bit unsigned seeds', () => {
    for (const seed of [randomSeed(), nextSeed(mulberry32(5))]) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});

describe('weightedPick', () => {
  it('picks in proportion to the weights', () => {
    const rng = mulberry32(11);
    const counts = { a: 0, b: 0, c: 0 };
    const weights = { a: 1, b: 3, c: 0 };
    for (let i = 0; i < 4000; i++) {
      const item = weightedPick(['a', 'b', 'c'] as const, (x) => weights[x], rng);
      if (item !== undefined) counts[item]++;
    }
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.6);
    expect(counts.b / counts.a).toBeLessThan(3.4);
  });

  it('gives undefined for an empty list without drawing', () => {
    let draws = 0;
    const rng = () => {
      draws++;
      return 0.5;
    };
    expect(weightedPick([], () => 1, rng)).toBeUndefined();
    expect(draws).toBe(0);
  });
});

describe('newId', () => {
  it('makes distinct UUID v4 strings', () => {
    const ids = Array.from({ length: 50 }, newId);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
