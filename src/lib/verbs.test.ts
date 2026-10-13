import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../data/schema.ts';
import { conjugate, FORMS } from './conjugate.ts';
import { furiganaFor, placeFurigana } from './furigana.ts';
import { displayForm, isConjugable } from './verbs.ts';

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

describe('isConjugable', () => {
  const all = WordsFileSchema.parse(fixtures);
  const byId = (id: string): Word => {
    const word = all.find((w) => w.id === id);
    if (word === undefined) throw new Error(`no fixture ${id}`);
    return word;
  };

  it('takes the verbs the engine conjugates in every form, nothing else', () => {
    for (const word of all.filter((w) => w.pos === 'verb')) {
      expect(isConjugable(word), word.id).toBe(true);
    }
    expect(isConjugable(byId('sensei'))).toBe(false);
    // 為る written for する: the validator reports it; the notebook and the drill leave it out
    expect(isConjugable({ ...byId('suru'), kanji: '為る' })).toBe(false);
    expect(isConjugable({ ...byId('kaku'), verbGroup: undefined })).toBe(false);
  });
});
