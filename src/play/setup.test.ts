import { describe, expect, it } from 'vitest';
import type { Word } from '../data/schema.ts';
import { quiz } from '../games/quiz/index.ts';
import { DEFAULT_SETUP, parseSetup, unavailableReason } from './setup.ts';

const known = new Set(['all', 'new', 'verbs-g1', 'occupations']);

describe('parseSetup', () => {
  it('reads a stored choice', () => {
    const stored = {
      deckIds: ['verbs-g1', 'occupations'],
      size: 20,
      options: { furigana: false, direction: 'mixed' },
    };
    expect(parseSetup(JSON.stringify(stored), known)).toEqual(stored);
  });

  it('falls back to the defaults for nothing or garbage', () => {
    expect(parseSetup(null, known)).toEqual(DEFAULT_SETUP);
    expect(parseSetup('{not json', known)).toEqual(DEFAULT_SETUP);
    expect(parseSetup('"text"', known)).toEqual(DEFAULT_SETUP);
  });

  it('drops decks that no longer exist, and repairs bad fields one by one', () => {
    const stored = {
      deckIds: ['gone', 'verbs-g1', 'verbs-g1'],
      size: 15,
      options: { furigana: 'yes', direction: 'reverse' },
    };
    expect(parseSetup(JSON.stringify(stored), known)).toEqual({
      deckIds: ['verbs-g1'],
      size: 10,
      options: { furigana: true, direction: 'reverse' },
    });
    expect(parseSetup(JSON.stringify({ deckIds: ['gone'] }), known).deckIds).toEqual(['all']);
  });
});

describe('unavailableReason', () => {
  const word = (id: string, en: string): Word => ({
    id,
    kana: 'あ',
    pos: 'noun',
    meaning: { en: [en] },
    tags: [],
    added: '2026-10-08',
  });

  it('needs minPool words, then the game’s own check', () => {
    const three = [word('a', 'one'), word('b', 'two'), word('c', 'three')];
    expect(unavailableReason(quiz, three, 'en')).toEqual({ key: 'game_unavailable_pool', n: 4 });
    const sameMeaning = [...three, word('d', 'three')];
    expect(unavailableReason(quiz, sameMeaning, 'en')).toEqual({ key: 'quiz_unavailable' });
    expect(unavailableReason(quiz, [...three, word('d', 'four')], 'en')).toBeUndefined();
  });
});
