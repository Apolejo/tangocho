import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import { GAMES } from '../games/registry.ts';
import type { Skill } from '../games/types.ts';
import { answerEvent } from './events.ts';
import { deckMastery, masteryLevel, trainableSkills } from './mastery.ts';
import { replay } from './srs.ts';

const all = WordsFileSchema.parse(fixtures);
const word = (id: string): Word => {
  const found = all.find((w) => w.id === id);
  if (found === undefined) throw new Error(`no fixture ${id}`);
  return found;
};

describe('masteryLevel: thresholds on FSRS stability (SPEC §10.5)', () => {
  it('is New for a card never answered', () => {
    expect(masteryLevel(undefined)).toBe('new');
  });

  it('is Learning under 3 days', () => {
    expect(masteryLevel(0.2)).toBe('learning');
    expect(masteryLevel(2.999)).toBe('learning');
  });

  it('is Familiar from 3 days to under 21', () => {
    expect(masteryLevel(3)).toBe('familiar');
    expect(masteryLevel(20.99)).toBe('familiar');
  });

  it('is Mastered from 21 days', () => {
    expect(masteryLevel(21)).toBe('mastered');
    expect(masteryLevel(400)).toBe('mastered');
  });
});

describe('trainableSkills: the cards a word has', () => {
  it('gives a verb with kanji all five', () => {
    expect(trainableSkills(word('taberu'), GAMES)).toEqual<Skill[]>([
      'meaning',
      'recall',
      'reading',
      'group',
      'conjugation',
    ]);
  });

  it('gives a word without kanji no reading card', () => {
    expect(trainableSkills(word('aru'), GAMES)).not.toContain('reading');
    expect(trainableSkills(word('enjinia'), GAMES)).toEqual<Skill[]>(['meaning', 'recall']);
  });

  it('gives a noun with kanji meaning, recall and reading', () => {
    expect(trainableSkills(word('sensei'), GAMES)).toEqual<Skill[]>([
      'meaning',
      'recall',
      'reading',
    ]);
  });
});

describe('deckMastery', () => {
  it("counts the deck's cards at each level", () => {
    const words = [word('sensei'), word('enjinia')]; // 3 + 2 cards
    const at = (days: number) => new Date(Date.UTC(2026, 0, 1 + days, 12));
    let n = 0;
    const answer = (wordId: string, skill: Skill, days: number) =>
      answerEvent(
        {
          roundId: 'r',
          game: 'quiz',
          wordId,
          skill,
          correct: true,
          hinted: false,
          ms: 1,
          device: 'd',
        },
        `a${n++}`,
        at(days),
      );
    // sensei|meaning answered right on a growing schedule until it is mastered
    const longRun = [0, 0.01, 3, 12, 40, 120].map((d) => answer('sensei', 'meaning', d));
    const cards = replay([
      ...longRun,
      answer('enjinia', 'recall', 0),
      answer('removed', 'meaning', 0),
    ]);
    expect(cards.get('sensei|meaning')?.fsrs.stability).toBeGreaterThanOrEqual(21);

    expect(deckMastery(words, GAMES, cards)).toEqual({
      new: 3,
      learning: 1,
      familiar: 0,
      mastered: 1,
      total: 5,
    });
  });
});
