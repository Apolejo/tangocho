import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import { conjugate, FORMS } from './conjugate.ts';
import { furiganaFor, placeFurigana } from './furigana.ts';
import { displayForm } from './verbs.ts';

// The ます forms themselves are rows of the conjugation table (conjugate.test.ts).

describe('displayForm', () => {
  const base: Word = {
    id: 'kaku',
    kanji: '書く',
    kana: 'かく',
    pos: 'verb',
    verbGroup: 1,
    meaning: { en: ['to write'] },
    tags: [],
    added: '2026-10-08',
  };

  it('shows verbs in ます form with automatic furigana', () => {
    const shown = displayForm(base);
    expect(shown).toEqual({ kanji: '書きます', kana: 'かきます' });
    expect(furiganaFor(shown)).toEqual([
      ['書', 'か'],
      ['きます', ''],
    ]);
  });

  it('shows everything else as stored', () => {
    const noun: Word = { ...base, id: 'sensei', kanji: '先生', kana: 'せんせい', pos: 'noun' };
    delete noun.verbGroup;
    expect(displayForm(noun)).toEqual({ kanji: '先生', kana: 'せんせい', furigana: undefined });
  });

  it('falls back to the stored form when the verb does not fit its group', () => {
    const misfit: Word = { ...base, verbGroup: 2 };
    expect(displayForm(misfit)).toEqual({ kanji: '書く', kana: 'かく', furigana: undefined });
  });

  it('every fixture verb has all eight forms, and their furigana places', () => {
    for (const word of WordsFileSchema.parse(fixtures)) {
      if (word.pos !== 'verb') continue;
      for (const form of FORMS) {
        const shown = conjugate(word, form);
        expect(shown, `${word.id} ${form}`).toBeDefined();
        if (shown?.kanji !== undefined) {
          expect(placeFurigana(shown.kanji, shown.kana).ok, `${word.id} ${form}`).toBe(true);
        }
      }
    }
  });
});
