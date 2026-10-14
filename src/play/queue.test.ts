import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import type { Minigame, RoundOptions, Skill } from '../games/types.ts';
import { mulberry32 } from '../lib/random.ts';
import { answerEvent, type AnswerEvent } from '../progress/events.ts';
import { replay } from '../progress/srs.ts';
import { buildQueue, practiceQueue } from './queue.ts';
import { DEFAULT_SETUP } from './setup.ts';

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
  ...DEFAULT_SETUP.options,
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

describe('buildQueue with forms', () => {
  const verbs = all.filter((w) => w.pos === 'verb');
  const drillLike: Pick<Minigame, 'skillsFor' | 'eligible' | 'formsFor'> = {
    skillsFor: () => ['conjugation'],
    eligible: (w) => w.pos === 'verb',
    formsFor: (_w, o) => o.forms,
  };
  const withForms = (forms: RoundOptions['forms']): RoundOptions => ({
    ...DEFAULT_SETUP.options,
    forms,
  });

  it('gives each card one of the selected forms', () => {
    const queue = buildQueue({
      pool: verbs,
      game: drillLike,
      options: withForms(['て', 'ない']),
      size: 20,
      rng: mulberry32(6),
    });
    expect(queue).toHaveLength(20);
    for (const { card } of queue) expect(['て', 'ない']).toContain(card.form);
    expect(new Set(queue.map((q) => q.card.form))).toEqual(new Set(['て', 'ない']));
  });

  it('asks the forms missed more often more often', () => {
    const counts = { て: 0, た: 0 };
    for (let seed = 0; seed < 100; seed++) {
      const queue = buildQueue({
        pool: verbs,
        game: drillLike,
        options: withForms(['て', 'た']),
        size: 20,
        rng: mulberry32(seed),
        formStats: new Map([
          ['て', { answers: 20, misses: 20 }],
          ['た', { answers: 20, misses: 0 }],
        ]),
      });
      for (const { card } of queue) counts[card.form as 'て' | 'た']++;
    }
    // weights 3.86 and 1.14: about 3.4 to 1
    expect(counts.て / counts.た).toBeGreaterThan(2.7);
    expect(counts.て / counts.た).toBeLessThan(4.2);
  });

  it('skips a word with no form to ask, and leaves games without forms alone', () => {
    const none = buildQueue({
      pool: verbs,
      game: { ...drillLike, formsFor: () => [] },
      options: withForms(['て']),
      size: 10,
      rng: mulberry32(7),
    });
    expect(none).toEqual([]);
    const quiz = buildQueue({
      pool: all,
      game: quizLike,
      options: opts('forward'),
      size: 10,
      rng: mulberry32(7),
    });
    for (const { card } of quiz) expect(card).not.toHaveProperty('form');
  });
});

describe('practiceQueue', () => {
  it('replays the cards as they were, shuffled, each with a seed', () => {
    const cards = [
      { wordId: 'kaku', skill: 'conjugation' as const, form: 'て' },
      { wordId: 'taberu', skill: 'conjugation' as const, form: 'ない' },
      { wordId: 'sensei', skill: 'recall' as const },
    ];
    const queue = practiceQueue(cards, mulberry32(8));
    expect(queue.map((q) => q.card).sort((a, b) => a.wordId.localeCompare(b.wordId))).toEqual(
      [...cards].sort((a, b) => a.wordId.localeCompare(b.wordId)),
    );
    expect(new Set(queue.map((q) => q.seed)).size).toBe(3);
  });
});

describe('buildQueue with spaced repetition (SPEC §10.2)', () => {
  const MINUTE = 60_000;
  const T0 = new Date(2026, 9, 10, 12, 0);
  const NOW = new Date(2026, 9, 11, 12, 0);
  const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);
  let n = 0;
  const answer = (wordId: string, when: Date, skill: Skill = 'meaning'): AnswerEvent =>
    answerEvent(
      {
        roundId: 'r',
        game: 'quiz',
        wordId,
        skill,
        correct: true,
        hinted: false,
        ms: 900,
        device: 'd',
      },
      `e${n++}`,
      when,
    );
  /** Answered once: in a 10-minute learning step, so due by NOW (earlier answers more overdue). */
  const learning = (wordId: string, minutes: number) => [answer(wordId, at(minutes))];
  /** Answered twice: scheduled days ahead, so seen but not due at NOW. */
  const graduated = (wordId: string, minutes: number) => [
    answer(wordId, at(minutes)),
    answer(wordId, at(minutes + 11)),
  ];
  const ids = all.map((w) => w.id);
  const queueOf = (
    events: AnswerEvent[],
    { size = 10, newLeft = 15, direction = 'forward' as RoundOptions['direction'], seed = 1 } = {},
  ) =>
    buildQueue({
      pool: all,
      game: quizLike,
      options: opts(direction),
      size,
      rng: mulberry32(seed),
      srs: { cards: replay(events), now: NOW, newLeft },
    }).map((q) => q.card);

  it('asks due cards first, the most overdue first', () => {
    const events = [
      ...learning(ids[0]!, 30),
      ...learning(ids[1]!, 10),
      ...learning(ids[2]!, 20),
      ...learning(ids[3]!, 40),
      ...graduated(ids[4]!, 0),
    ];
    expect(
      queueOf(events, { size: 3 })
        .map((c) => c.wordId)
        .sort(),
    ).toEqual([ids[0]!, ids[1]!, ids[2]!].sort());
    expect(queueOf(events, { size: 4 }).map((c) => c.wordId)).not.toContain(ids[4]);
  });

  it('caps new cards at the daily limit before the seen ones, and fills the round past it', () => {
    const seenIds = ids.slice(0, 5);
    const events = seenIds.flatMap((id, i) => graduated(id, i * 20));
    const isSeen = (c: { wordId: string }) => seenIds.includes(c.wordId);

    const capped = queueOf(events, { size: 8, newLeft: 3 });
    expect(capped).toHaveLength(8);
    expect(capped.filter(isSeen)).toHaveLength(5);

    const filled = queueOf(events, { size: 10, newLeft: 3 });
    expect(filled).toHaveLength(10);
    expect(filled.filter(isSeen)).toHaveLength(5);
    expect(filled.filter((c) => !isSeen(c))).toHaveLength(5);

    const noneLeft = queueOf(events, { size: 5, newLeft: 0 });
    expect(noneLeft.every(isSeen)).toBe(true);
  });

  it('takes the least recently seen cards first as extra practice', () => {
    const events = [...graduated(ids[0]!, 60), ...graduated(ids[1]!, 0), ...graduated(ids[2]!, 30)];
    const picked = queueOf(events, { size: 2, newLeft: 0 }).map((c) => c.wordId);
    expect(picked.sort()).toEqual([ids[1]!, ids[2]!].sort());
  });

  it('gives a word one card, the due one over a new one, in mixed mode', () => {
    const events = [answer(ids[0]!, at(0), 'recall')];
    for (let seed = 0; seed < 10; seed++) {
      const queue = queueOf(events, { size: 44, direction: 'mixed', seed });
      expect(new Set(queue.map((c) => c.wordId)).size).toBe(queue.length);
      expect(queue.find((c) => c.wordId === ids[0])?.skill).toBe('recall');
    }
  });

  it('ignores cards whose word is no longer in the pool', () => {
    const events = [...learning('removed-word', 0), ...learning(ids[0]!, 5)];
    const queue = queueOf(events, { size: 44 });
    expect(queue.map((c) => c.wordId)).not.toContain('removed-word');
    expect(queue).toHaveLength(all.length);
  });

  it('is the same queue for the same seed', () => {
    const events = [...learning(ids[0]!, 0), ...graduated(ids[1]!, 5)];
    expect(queueOf(events, { seed: 9 })).toEqual(queueOf(events, { seed: 9 }));
  });
});
