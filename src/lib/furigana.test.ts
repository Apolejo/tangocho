import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema } from '../data/schema.ts';
import { furiganaFor, joinsBack, placeFurigana, splitRuns } from './furigana.ts';

const place = (written: string, reading: string) => {
  const p = placeFurigana(written, reading);
  return p.ok ? p.pairs : p.reason;
};

describe('placeFurigana', () => {
  it('splits runs, keeping 々 and ヶ in the kanji run', () => {
    expect(splitRuns('引き出し')).toEqual([
      { text: '引', kanji: true },
      { text: 'き', kanji: false },
      { text: '出', kanji: true },
      { text: 'し', kanji: false },
    ]);
    expect(splitRuns('一ヶ月')).toEqual([{ text: '一ヶ月', kanji: true }]);
  });

  it('places the SPEC §5.4 examples', () => {
    expect(place('食べる', 'たべる')).toEqual([
      ['食', 'た'],
      ['べる', ''],
    ]);
    expect(place('引き出し', 'ひきだし')).toEqual([
      ['引', 'ひ'],
      ['き', ''],
      ['出', 'だ'],
      ['し', ''],
    ]);
    expect(place('先生', 'せんせい')).toEqual([['先生', 'せんせい']]);
    expect(place('時々', 'ときどき')).toEqual([['時々', 'ときどき']]);
    expect(place('一ヶ月', 'いっかげつ')).toEqual([['一ヶ月', 'いっかげつ']]);
  });

  it('uses katakana in the written form as an anchor', () => {
    expect(place('ピアノ教室', 'ピアノきょうしつ')).toEqual([
      ['ピアノ', ''],
      ['教室', 'きょうしつ'],
    ]);
  });

  it('reports a word without kanji', () => {
    expect(place('たべる', 'たべる')).toBe('no-kanji');
  });

  it('reports a reading that does not fit', () => {
    expect(place('食べる', 'たる')).toBe('no-solution');
    expect(place('食べる', 'べる')).toBe('no-solution');
    expect(place('食べる', 'たべます')).toBe('no-solution');
  });

  it('reports an ambiguous placement', () => {
    expect(place('書き込', 'きききき')).toBe('ambiguous');
  });

  it('places every fixture word with kanji and joins back', () => {
    for (const word of WordsFileSchema.parse(fixtures)) {
      if (word.kanji === undefined) continue;
      const placed = placeFurigana(word.kanji, word.kana);
      expect(placed.ok, `${word.id}: ${placed.ok ? '' : placed.reason}`).toBe(true);
      if (placed.ok) expect(joinsBack(placed.pairs, word.kanji, word.kana)).toBe(true);
    }
  });
});

describe('joinsBack', () => {
  it('accepts pairs that rebuild both forms', () => {
    expect(
      joinsBack(
        [
          ['引', 'ひ'],
          ['き', ''],
          ['出', 'だ'],
          ['し', ''],
        ],
        '引き出し',
        'ひきだし',
      ),
    ).toBe(true);
  });

  it('rejects pairs that do not', () => {
    expect(joinsBack([['引', 'ひ']], '引き出し', 'ひきだし')).toBe(false);
    expect(
      joinsBack(
        [
          ['引き', 'ひき'],
          ['出し', 'でし'],
        ],
        '引き出し',
        'ひきだし',
      ),
    ).toBe(false);
  });
});

describe('furiganaFor', () => {
  it('prefers the manual override', () => {
    const manual: [string, string][] = [['食べる', 'たべる']];
    expect(furiganaFor({ kanji: '食べる', kana: 'たべる', furigana: manual })).toBe(manual);
  });

  it('places automatically otherwise', () => {
    expect(furiganaFor({ kanji: '食べる', kana: 'たべる' })).toEqual([
      ['食', 'た'],
      ['べる', ''],
    ]);
  });

  it('falls back to one ruby group when placement fails', () => {
    expect(furiganaFor({ kanji: '書き込', kana: 'きききき' })).toEqual([['書き込', 'きききき']]);
  });

  it('renders kana-only words as plain text', () => {
    expect(furiganaFor({ kana: 'デザイナー' })).toEqual([['デザイナー', '']]);
  });
});
