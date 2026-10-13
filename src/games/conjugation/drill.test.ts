import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../../data/schema.ts';
import { conjugate } from '../../lib/conjugate.ts';
import { finishKana, typeKana } from '../../lib/kana.ts';
import { asForm, checkTyped, promptForm, withReading, written } from './drill.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};

describe('forms', () => {
  it('reads only real form ids', () => {
    expect(asForm('て')).toBe('て');
    expect(asForm('te')).toBeUndefined();
    expect(asForm(undefined)).toBeUndefined();
  });

  it('shows the ます form, or the dictionary form when ます is asked', () => {
    expect(promptForm('て')).toBe('ます');
    expect(promptForm('辞書形')).toBe('ます');
    expect(promptForm('ます')).toBe('辞書形');
  });

  it('writes a form with its reading', () => {
    expect(withReading({ kanji: '来ない', kana: 'こない' })).toBe('来ない（こない）');
    expect(withReading({ kana: 'しない' })).toBe('しない');
    expect(written({ kanji: '書いて', kana: 'かいて' })).toBe('書いて');
  });
});

describe('checkTyped', () => {
  const expected = (id: string, form: Parameters<typeof conjugate>[1]) => {
    const c = conjugate(byId(id), form);
    if (c === undefined) throw new Error(`can't conjugate ${id}`);
    return c;
  };

  it('accepts the kana or the written form (こない or 来ない)', () => {
    const konai = expected('kuru', 'ない');
    expect(checkTyped('こない', konai)).toBe(true);
    expect(checkTyped('来ない', konai)).toBe(true);
    expect(checkTyped('きない', konai)).toBe(false);
    expect(checkTyped('来ない ', konai)).toBe(true);
  });

  it('takes romaji finished in the answer’s script, and either script', () => {
    const kaite = expected('kaku', 'て');
    expect(checkTyped(finishKana('kaite', kaite.kana), kaite)).toBe(true);
    expect(checkTyped('カイテ', kaite)).toBe(true);
    expect(checkTyped('かって', kaite)).toBe(false);
    expect(checkTyped('書って', kaite)).toBe(false);
    const benkyou = expected('benkyou-suru', 'ません');
    expect(checkTyped(finishKana('benkyoushimasen', benkyou.kana), benkyou)).toBe(true);
    const copy = conjugate({ kana: 'コピーする', verbGroup: 3 }, 'て');
    expect(copy && checkTyped('こぴいして', copy)).toBe(true);
    expect(copy && checkTyped('コピして', copy)).toBe(false);
  });

  it('keeps the ん typed as n or nn, as the field converts it key by key', () => {
    /** What the field holds after typing `romaji` one key at a time, then submitting. */
    const typed = (romaji: string, answer: string): string => {
      let value = '';
      for (const key of romaji) value = typeKana(value + key, value.length + 1, answer).value;
      return finishKana(value, answer);
    };
    const yonde = expected('yomu', 'て');
    expect(checkTyped(typed('yonde', yonde.kana), yonde)).toBe(true);
    const shinde = expected('shinu', 'て');
    expect(checkTyped(typed('shinnde', shinde.kana), shinde)).toBe(true);
    const shinanai = expected('shinu', 'ない');
    expect(checkTyped(typed('shinanai', shinanai.kana), shinanai)).toBe(true);
  });

  it('judges nothing typed as wrong', () => {
    expect(checkTyped('  ', expected('kaku', 'た'))).toBe(false);
  });
});
