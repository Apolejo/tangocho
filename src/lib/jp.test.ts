import { describe, expect, it } from 'vitest';
import {
  chars,
  hasKanji,
  isHiragana,
  isKana,
  isKanaFieldChar,
  isKanji,
  isKanjiFieldChar,
  isKanjiRunChar,
  isKatakana,
  trailingKana,
} from './jp.ts';

describe('character classes', () => {
  it('recognizes kanji, including outside the basic plane', () => {
    expect(isKanji('食')).toBe(true);
    expect(isKanji('𠮟')).toBe(true);
    expect(isKanji('た')).toBe(false);
    expect(isKanji('々')).toBe(false);
  });

  it('recognizes hiragana and katakana, with ー as katakana', () => {
    expect(isHiragana('た')).toBe(true);
    expect(isKatakana('デ')).toBe(true);
    expect(isKatakana('ー')).toBe(true);
    expect(isKana('ー')).toBe(true);
    expect(isKatakana('・')).toBe(false);
    expect(isKana('a')).toBe(false);
  });

  it('counts ヶ as kana like WanaKana does, but puts it in the kanji run', () => {
    expect(isKana('ヶ')).toBe(true);
    expect(isKanjiRunChar('ヶ')).toBe(true);
    expect(isKanjiRunChar('々')).toBe(true);
    expect(isKanjiRunChar('べ')).toBe(false);
  });

  it('defines the allowed characters of each field', () => {
    expect(['か', 'ー', 'デ'].every(isKanaFieldChar)).toBe(true);
    expect(['k', '漢', '。', ' '].some(isKanaFieldChar)).toBe(false);
    expect(['食', 'べ', 'ー', '々', 'ヶ'].every(isKanjiFieldChar)).toBe(true);
    expect(['k', '。', '・'].some(isKanjiFieldChar)).toBe(false);
  });

  it('splits into code points', () => {
    expect(chars('𠮟る')).toEqual(['𠮟', 'る']);
  });

  it('finds kanji and the trailing kana', () => {
    expect(hasKanji('食べる')).toBe(true);
    expect(hasKanji('たべる')).toBe(false);
    expect(trailingKana('食べる')).toBe('べる');
    expect(trailingKana('先生')).toBe('');
    expect(trailingKana('勉強する')).toBe('する');
    expect(trailingKana('一ヶ月')).toBe('');
  });
});
