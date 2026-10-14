import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema } from '../data/schema.ts';
import { conjugation } from '../games/conjugation/index.ts';
import { quiz } from '../games/quiz/index.ts';
import { sorter } from '../games/sorter/index.ts';
import type { RoundOptions } from '../games/types.ts';
import { mulberry32 } from '../lib/random.ts';
import { eligibleWords, planRound } from './plan.ts';
import { DEFAULT_SETUP } from './setup.ts';

const all = WordsFileSchema.parse(fixtures);
const verbs = all.filter((w) => w.pos === 'verb');
const options: RoundOptions = DEFAULT_SETUP.options;

describe('eligibleWords', () => {
  it('keeps every word for the quiz', () => {
    expect(eligibleWords(quiz, options, all)).toEqual(all);
  });

  it('keeps only the verbs for the sorter', () => {
    expect(verbs.length).toBeGreaterThan(0);
    expect(verbs.length).toBeLessThan(all.length);
    expect(eligibleWords(sorter, options, all)).toEqual(verbs);
  });
});

describe('planRound', () => {
  it('asks the sorter about verbs only, with the group skill', () => {
    for (const seed of [1, 2, 3]) {
      const plan = planRound({
        id: 'r',
        game: sorter,
        deckIds: ['all'],
        size: 20,
        options,
        words: all,
        rng: mulberry32(seed),
      });
      expect(plan.pool).toEqual(verbs);
      expect(plan.queue).toHaveLength(20);
      for (const { card } of plan.queue) {
        expect(card.skill).toBe('group');
        expect(verbs.some((w) => w.id === card.wordId)).toBe(true);
      }
    }
  });

  it('gives an empty queue when the decks have no verbs', () => {
    const nouns = all.filter((w) => w.pos !== 'verb');
    const plan = planRound({
      id: 'r',
      game: sorter,
      deckIds: ['occupations'],
      size: 10,
      options,
      words: nouns,
      rng: mulberry32(1),
    });
    expect(plan.pool).toEqual([]);
    expect(plan.queue).toEqual([]);
  });
});

describe('planRound for practice', () => {
  it('replays the missed cards and sizes the round by them', () => {
    const only = [
      { wordId: 'kaku', skill: 'group' as const },
      { wordId: 'taberu', skill: 'group' as const },
    ];
    const plan = planRound({
      id: 'r',
      game: sorter,
      deckIds: ['verbs-g1'],
      size: 20,
      options,
      words: verbs,
      only,
      rng: mulberry32(1),
    });
    expect(plan.practice).toBe(true);
    expect(plan.size).toBe(2);
    expect(plan.queue.map((q) => q.card.wordId).sort()).toEqual(['kaku', 'taberu']);
    expect(plan.pool).toEqual(verbs);
  });

  it('draws a selected form for a card without one, and drops cards of missing words', () => {
    const only = [
      { wordId: 'kaku', skill: 'conjugation' as const },
      { wordId: 'taberu', skill: 'conjugation' as const, form: 'た' },
      { wordId: 'gone', skill: 'conjugation' as const },
    ];
    for (const seed of [1, 2, 3, 4]) {
      const plan = planRound({
        id: 'r',
        game: conjugation,
        deckIds: ['all'],
        size: 10,
        options: { ...options, forms: ['て', 'ない'] },
        words: all,
        only,
        rng: mulberry32(seed),
      });
      const byWord = new Map(plan.queue.map((q) => [q.card.wordId, q.card]));
      expect([...byWord.keys()].sort()).toEqual(['kaku', 'taberu']);
      expect(['て', 'ない']).toContain(byWord.get('kaku')?.form);
      expect(byWord.get('taberu')?.form).toBe('た');
    }
  });
});
