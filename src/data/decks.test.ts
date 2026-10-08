import { describe, expect, it } from 'vitest';
import {
  deckId,
  isNewThisWeek,
  matchesDeck,
  notebookDecks,
  wordsInDeck,
  type NotebookDeck,
} from './decks.ts';
import type { Deck, Word } from './schema.ts';

const word = (over: Partial<Word>): Word => ({
  id: 'kaku',
  kanji: '書く',
  kana: 'かく',
  pos: 'verb',
  verbGroup: 1,
  meaning: { en: ['to write'] },
  tags: [],
  added: '2026-10-08',
  ...over,
});

const verb1 = word({ id: 'kaku' });
const verb2 = word({ id: 'taberu', kanji: '食べる', kana: 'たべる', verbGroup: 2 });
const noun = word({
  id: 'sensei',
  kanji: '先生',
  kana: 'せんせい',
  pos: 'noun',
  verbGroup: undefined,
  tags: ['occupations', 'school'],
  added: '2026-09-01',
});

describe('matchesDeck', () => {
  it('matches on every given field', () => {
    expect(matchesDeck(verb1, { pos: 'verb' })).toBe(true);
    expect(matchesDeck(verb1, { pos: 'verb', verbGroup: 1 })).toBe(true);
    expect(matchesDeck(verb2, { pos: 'verb', verbGroup: 1 })).toBe(false);
    expect(matchesDeck(noun, { pos: 'verb' })).toBe(false);
  });

  it('requires all listed tags', () => {
    expect(matchesDeck(noun, { tags: ['occupations'] })).toBe(true);
    expect(matchesDeck(noun, { tags: ['occupations', 'school'] })).toBe(true);
    expect(matchesDeck(noun, { tags: ['occupations', 'food'] })).toBe(false);
    expect(matchesDeck(verb1, { tags: [] })).toBe(true);
  });

  it('matches everything with an empty query', () => {
    expect(matchesDeck(noun, {})).toBe(true);
  });
});

describe('isNewThisWeek', () => {
  const now = new Date(2026, 9, 8, 15, 30);

  it('counts today and the six days before', () => {
    expect(isNewThisWeek('2026-10-08', now)).toBe(true);
    expect(isNewThisWeek('2026-10-02', now)).toBe(true);
    expect(isNewThisWeek('2026-10-01', now)).toBe(false);
    expect(isNewThisWeek('2026-10-09', now)).toBe(false);
  });

  it('ignores a malformed date', () => {
    expect(isNewThisWeek('yesterday', now)).toBe(false);
  });
});

describe('wordsInDeck', () => {
  const now = new Date(2026, 9, 8);
  const words = [verb1, verb2, noun];
  const occupations: Deck = {
    id: 'occupations',
    name: { en: 'Occupations', es: 'Ocupaciones' },
    match: { tags: ['occupations'] },
  };

  it('lists the built-in decks first, then the data decks', () => {
    const decks = notebookDecks([occupations]);
    expect(decks.map(deckId)).toEqual(['all', 'new', 'occupations']);
  });

  it('fills built-in and data decks', () => {
    const [all, fresh, data] = notebookDecks([occupations]) as [
      NotebookDeck,
      NotebookDeck,
      NotebookDeck,
    ];
    expect(wordsInDeck(all, words, now)).toEqual(words);
    expect(wordsInDeck(fresh, words, now).map((w) => w.id)).toEqual(['kaku', 'taberu']);
    expect(wordsInDeck(data, words, now).map((w) => w.id)).toEqual(['sensei']);
  });
});
