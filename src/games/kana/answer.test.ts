import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../../data/schema.ts';
import { finishKana } from '../../lib/kana.ts';
import type { Skill } from '../types.ts';
import { acceptedForms, checkKana, expectedKana, hasKanjiForm, hintKana } from './answer.ts';

const all = WordsFileSchema.parse(fixtures);
const fixture = (id: string): Word => {
  const found = all.find((w) => w.id === id);
  if (found === undefined) throw new Error(`no fixture ${id}`);
  return found;
};

const word = (over: Partial<Word> & Pick<Word, 'id' | 'kana'>): Word => ({
  pos: 'noun',
  meaning: { en: [over.id], es: [over.id] },
  tags: [],
  added: '2026-10-08',
  ...over,
});

/** Submits `typed` for `target`, as the game does: finish the conversion, then check. */
function check(target: Word, typed: string, skill: Skill = 'reading', allWords = all) {
  const given = finishKana(typed, expectedKana(target));
  return { given, ...checkKana({ given, word: target, skill, allWords, lang: 'es' }) };
}

describe('acceptedForms', () => {
  it('takes the kana and the exact kanji form', () => {
    expect(acceptedForms(fixture('sensei'))).toEqual(['せんせい', '先生']);
    expect(acceptedForms(fixture('dezainaa'))).toEqual(['デザイナー']);
  });

  it('takes verbs in ます form first, then the dictionary form', () => {
    expect(acceptedForms(fixture('taberu'))).toEqual(['たべます', '食べます', 'たべる', '食べる']);
    expect(acceptedForms(fixture('kuru'))).toEqual(['きます', '来ます', 'くる', '来る']);
    expect(acceptedForms(fixture('benkyou-suru'))).toEqual([
      'べんきょうします',
      '勉強します',
      'べんきょうする',
      '勉強する',
    ]);
  });
});

describe('checkKana (SPEC §9.3)', () => {
  it('accepts romaji, kana and the exact kanji form', () => {
    expect(check(fixture('sensei'), 'sensei')).toMatchObject({ correct: true, given: 'せんせい' });
    expect(check(fixture('sensei'), 'せんせい').correct).toBe(true);
    expect(check(fixture('sensei'), '先生').correct).toBe(true);
    expect(check(fixture('sensei'), '先性').correct).toBe(false);
  });

  it('finishes a trailing n in the expected script', () => {
    expect(check(fixture('kaishain'), 'かいしゃいn')).toMatchObject({
      correct: true,
      given: 'かいしゃいん',
    });
    expect(check(fixture('sarariiman'), 'サラリーマn')).toMatchObject({
      correct: true,
      given: 'サラリーマン',
    });
  });

  it('takes a verb in ます or dictionary form, as kana or kanji', () => {
    for (const typed of ['tabemasu', 'たべます', '食べます', 'taberu', '食べる']) {
      const result = check(fixture('taberu'), typed);
      expect(result.correct).toBe(true);
      expect(result).not.toHaveProperty('spelled');
    }
    expect(check(fixture('kuru'), 'kimasu').correct).toBe(true);
    expect(check(fixture('kuru'), 'kunai').correct).toBe(false);
  });

  it('ignores the script, with a note on how the word is written', () => {
    expect(check(fixture('taberu'), 'タベマス')).toMatchObject({
      correct: true,
      spelled: 'たべます',
    });
    expect(check(fixture('dezainaa'), 'でざいなー')).toMatchObject({
      correct: true,
      spelled: 'デザイナー',
    });
    const kopii = word({ id: 'kopii-suru', kana: 'コピーする', pos: 'verb', verbGroup: 3 });
    expect(check(kopii, 'こぴーします')).toMatchObject({ correct: true, spelled: 'コピーします' });
    expect(check(kopii, 'kopi-shimasu')).not.toHaveProperty('spelled');
    expect(check(kopii, 'kopi-shimasu').correct).toBe(true);
  });

  it('in katakana, takes ー or the vowel it lengthens', () => {
    expect(check(fixture('dezainaa'), 'dezaina-')).toMatchObject({ correct: true });
    expect(check(fixture('dezainaa'), 'dezainaa')).toMatchObject({
      correct: true,
      spelled: 'デザイナー',
    });
    expect(check(fixture('koohii'), 'koohii').correct).toBe(true);
    expect(check(fixture('koohii'), 'ko-hi-').correct).toBe(true);
    expect(check(fixture('koohii'), 'kouhii').correct).toBe(false);
  });

  it('compares hiragana exactly, so long vowels must be right', () => {
    const tooi = word({ id: 'tooi', kanji: '遠い', kana: 'とおい', pos: 'i-adj' });
    expect(check(tooi, 'tooi').correct).toBe(true);
    expect(check(tooi, 'toui').correct).toBe(false);
    expect(check(fixture('sensei'), 'センセー').correct).toBe(false);
    expect(check(fixture('kyou'), 'kyoo').correct).toBe(false);
  });

  it('takes nothing for an empty answer', () => {
    expect(check(fixture('sensei'), '  ').correct).toBe(false);
  });

  describe('recall mode', () => {
    const tsuzuku = word({
      id: 'tsuzuku',
      kanji: '続く',
      kana: 'つづく',
      pos: 'verb',
      verbGroup: 1,
      meaning: { es: ['continuar'], en: ['to continue (itself)'] },
    });
    const tsuzukeru = word({
      id: 'tsuzukeru',
      kanji: '続ける',
      kana: 'つづける',
      pos: 'verb',
      verbGroup: 2,
      meaning: { es: ['continuar'], en: ['to continue (something)'] },
    });
    const apaato = word({
      id: 'apaato',
      kana: 'アパート',
      meaning: { es: ['apartamento (construcción ligera)'] },
    });
    const manshon = word({
      id: 'manshon',
      kana: 'マンション',
      meaning: { es: ['apartamento (construcción sólida)'] },
    });
    const words = [tsuzuku, tsuzukeru, apaato, manshon];

    it('counts a word with the same meaning, and says which word the card was', () => {
      // づ is du, as on a Japanese keyboard: tsuzuku would be つずく
      const result = check(tsuzuku, 'tsudukemasu', 'recall', words);
      expect(result.correct).toBe(true);
      expect(result.matched?.id).toBe('tsuzukeru');
      expect(check(tsuzuku, 'tsudukimasu', 'recall', words).matched?.id).toBe('tsuzuku');
      expect(check(tsuzuku, 'tsuzukimasu', 'recall', words).correct).toBe(false);
    });

    it('compares the meaning in the language shown', () => {
      const en = checkKana({
        given: 'つづけます',
        word: tsuzuku,
        skill: 'recall',
        allWords: words,
        lang: 'en',
      });
      expect(en.correct).toBe(false);
    });

    it('needs the whole meaning, not one shared gloss', () => {
      expect(check(apaato, 'manshon', 'recall', words).correct).toBe(false);
    });

    it('never applies in reading mode', () => {
      expect(check(tsuzuku, 'tsudukemasu', 'reading', words).correct).toBe(false);
    });
  });
});

describe('hints and eligibility', () => {
  it('hints the first kana of the answer as shown', () => {
    expect(hintKana(fixture('taberu'))).toBe('た');
    expect(hintKana(fixture('kyou'))).toBe('き');
    expect(hintKana(fixture('dezainaa'))).toBe('デ');
  });

  it('asks readings only of words with a kanji form', () => {
    expect(hasKanjiForm(fixture('sensei'))).toBe(true);
    expect(hasKanjiForm(fixture('dezainaa'))).toBe(false);
    expect(hasKanjiForm(fixture('suru'))).toBe(false);
    expect(all.filter(hasKanjiForm)).toHaveLength(28);
  });
});
