import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import type { Minigame, RoundOptions, Skill } from '../games/types.ts';
import { mulberry32 } from '../lib/random.ts';
import { buildQueue } from './queue.ts';

const all = WordsFileSchema.parse(fixtures);

const quizLike: Pick<Minigame, 'skillsFor' | 'eligible'> = {
  skillsFor: (o) =>
    o.direction === 'forward'
      ? ['meaning']
      : o.direction === 'reverse'
        ? ['recall']
        : ['meaning', 'recall'],
  eligible: () => true,
};

const opts = (direction: RoundOptions['direction']): RoundOptions => ({
  furigana: true,
  direction,
});

describe('buildQueue', () => {
  it('takes `size` distinct words from the pool', () => {
    const queue = buildQueue({
      pool: all,
      game: quizLike,
      options: opts('forward'),
      size: 10,
      rng: mulberry32(1),
    });
    expect(queue).toHaveLength(10);
    const ids = queue.map((q) => q.card.wordId);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) expect(all.some((w) => w.id === id)).toBe(true);
  });

  it('is shorter when the pool is smaller than the round', () => {
    const pool = all.slice(0, 3);
    const queue = buildQueue({
      pool,
      game: quizLike,
      options: opts('forward'),
      size: 10,
      rng: mulberry32(1),
    });
    expect(queue.map((q) => q.card.wordId).sort()).toEqual(pool.map((w) => w.id).sort());
  });

  it('shuffles: different seeds give different orders', () => {
    const order = (seed: number) =>
      buildQueue({
        pool: all,
        game: quizLike,
        options: opts('forward'),
        size: 20,
        rng: mulberry32(seed),
      })
        .map((q) => q.card.wordId)
        .join();
    expect(order(1)).toBe(order(1));
    expect(order(1)).not.toBe(order(2));
  });

  it('uses the skills the direction asks for', () => {
    const skills = (direction: RoundOptions['direction']): Set<Skill> =>
      new Set(
        buildQueue({
          pool: all,
          game: quizLike,
          options: opts(direction),
          size: 40,
          rng: mulberry32(3),
        }).map((q) => q.card.skill),
      );
    expect(skills('forward')).toEqual(new Set(['meaning']));
    expect(skills('reverse')).toEqual(new Set(['recall']));
    expect(skills('mixed')).toEqual(new Set(['meaning', 'recall']));
  });

  it('skips words that no requested skill can use', () => {
    const kanjiOnly: Pick<Minigame, 'skillsFor' | 'eligible'> = {
      skillsFor: () => ['reading'],
      eligible: (w: Word) => w.kanji !== undefined,
    };
    const queue = buildQueue({
      pool: all,
      game: kanjiOnly,
      options: opts('forward'),
      size: 100,
      rng: mulberry32(4),
    });
    expect(queue.length).toBe(all.filter((w) => w.kanji !== undefined).length);
  });

  it('gives each card its own seed', () => {
    const queue = buildQueue({
      pool: all,
      game: quizLike,
      options: opts('mixed'),
      size: 20,
      rng: mulberry32(5),
    });
    expect(new Set(queue.map((q) => q.seed)).size).toBe(20);
  });
});
