import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import {
  checkDecks,
  checkWords,
  isGroup1Exception,
  looksLikeGroup2,
  type Located,
  type Problem,
} from './rules.ts';
import { WordsFileSchema, type Deck, type Word } from './schema.ts';

const base: Word = {
  id: 'kaku',
  kanji: '書く',
  kana: 'かく',
  pos: 'verb',
  verbGroup: 1,
  meaning: { en: ['to write'], es: ['escribir'] },
  tags: [],
  added: '2026-10-08',
};

const word = (over: Partial<Word>, file = 'test.json'): Located<Word> => ({
  value: { ...base, ...over },
  file,
});

const noun = { pos: 'noun' as const, verbGroup: undefined };
const codes = (problems: Problem[]) => problems.map((p) => p.code);
const errors = (problems: Problem[]) => problems.filter((p) => p.level === 'error');
const check = (...words: Located<Word>[]) => checkWords(words);

describe('helpers', () => {
  it('recognizes the -iru/-eru shape', () => {
    expect(looksLikeGroup2('たべる')).toBe(true);
    expect(looksLikeGroup2('おきる')).toBe(true);
    expect(looksLikeGroup2('かえる')).toBe(true);
    expect(looksLikeGroup2('かく')).toBe(false);
    expect(looksLikeGroup2('のる')).toBe(false);
    expect(looksLikeGroup2('る')).toBe(false);
  });

  it('matches exceptions on kanji + kana together, as a suffix', () => {
    expect(isGroup1Exception({ kanji: '帰る', kana: 'かえる' })).toBe(true);
    expect(isGroup1Exception({ kanji: '持ち帰る', kana: 'もちかえる' })).toBe(true);
    expect(isGroup1Exception({ kanji: '寝る', kana: 'ねる' })).toBe(false);
    expect(isGroup1Exception({ kanji: '練る', kana: 'ねる' })).toBe(true);
    expect(isGroup1Exception({ kana: 'いる' })).toBe(false);
  });
});

describe('checkWords errors', () => {
  it('passes a correct word', () => {
    expect(check(word({}))).toEqual([]);
  });

  it('dup-id: within the set and against the live set', () => {
    const same = check(word({}, 'a.json'), word({}, 'b.json'));
    expect(codes(same)).toEqual(['dup-id']);
    expect(same[0]?.message).toContain('a.json');
    const staged = checkWords([word({}, 'inbox/staged.json')], [word({}, 'data/words/x.json')]);
    expect(codes(staged)).toEqual(['dup-id']);
  });

  it('kana-chars: only kana and ー', () => {
    expect(codes(check(word({ kanji: undefined, kana: 'kaku' })))).toContain('kana-chars');
    expect(codes(check(word({ kanji: undefined, kana: 'かく。' })))).toContain('kana-chars');
    expect(check(word({ ...noun, kanji: undefined, kana: 'デザイナー' }))).toEqual([]);
  });

  it('kanji-chars: at least one kanji, nothing outside kanji, kana, ー, 々, ヶ', () => {
    expect(codes(check(word({ kanji: 'かく' })))).toContain('kanji-chars');
    expect(codes(check(word({ kanji: '書く!' })))).toContain('kanji-chars');
    expect(check(word({ ...noun, pos: 'adverb', kanji: '時々', kana: 'ときどき' }))).toEqual([]);
  });

  it('furigana: placement must succeed or be given by hand', () => {
    expect(codes(check(word({ kanji: '食べる', kana: 'たる', verbGroup: 2 })))).toContain(
      'furigana',
    );
    expect(codes(check(word({ ...noun, kanji: '書き込', kana: 'きききき' })))).toEqual([
      'furigana',
    ]);
    const manual: [string, string][] = [
      ['書', 'き'],
      ['き', ''],
      ['込', 'きき'],
    ];
    expect(check(word({ ...noun, kanji: '書き込', kana: 'きききき', furigana: manual }))).toEqual(
      [],
    );
    const broken: [string, string][] = [['書', 'き']];
    expect(
      codes(check(word({ ...noun, kanji: '書き込', kana: 'きききき', furigana: broken }))),
    ).toEqual(['furigana']);
    const kanaOnly: [string, string][] = [['かく', '']];
    expect(
      codes(check(word({ ...noun, kanji: undefined, kana: 'かく', furigana: kanaOnly }))),
    ).toEqual(['furigana']);
  });

  it('verb-group-missing / verb-group-forbidden', () => {
    expect(codes(check(word({ verbGroup: undefined })))).toEqual(['verb-group-missing']);
    expect(codes(check(word({ kanji: '先生', kana: 'せんせい', pos: 'noun' })))).toEqual([
      'verb-group-forbidden',
    ]);
  });

  it('verb-ending: dictionary form', () => {
    expect(codes(check(word({ kanji: '書き', kana: 'かき' })))).toContain('verb-ending');
  });

  it('g2-ending and g2-exception', () => {
    expect(codes(check(word({ verbGroup: 2 })))).toEqual(['g2-ending']);
    expect(codes(check(word({ kanji: '帰る', kana: 'かえる', verbGroup: 2 })))).toEqual([
      'g2-exception',
    ]);
    expect(codes(check(word({ kanji: '持ち帰る', kana: 'もちかえる', verbGroup: 2 })))).toEqual([
      'g2-exception',
    ]);
    expect(check(word({ kanji: '寝る', kana: 'ねる', verbGroup: 2 }))).toEqual([]);
  });

  it('g3-form: する, くる, noun + する, ...てくる/でくる/にくる', () => {
    expect(codes(check(word({ verbGroup: 3 })))).toEqual(['g3-form']);
    expect(codes(check(word({ kanji: '出来る', kana: 'できる', verbGroup: 3 })))).toEqual([
      'g3-form',
    ]);
    const fine: [string | undefined, string][] = [
      [undefined, 'する'],
      ['来る', 'くる'],
      ['勉強する', 'べんきょうする'],
      ['持ってくる', 'もってくる'],
      ['迎えに来る', 'むかえにくる'],
    ];
    for (const [kanji, kana] of fine) {
      expect(check(word({ kanji, kana, verbGroup: 3 }))).toEqual([]);
    }
  });

  it('kanji-kana-ending: the okurigana must match', () => {
    expect(codes(check(word({ kanji: '書く', kana: 'かう' })))).toContain('kanji-kana-ending');
  });
});

describe('checkWords warnings', () => {
  it('g1-looks-g2 unless on the exceptions list', () => {
    const warned = check(word({ kanji: '起きる', kana: 'おきる' }));
    expect(codes(warned)).toEqual(['g1-looks-g2']);
    expect(warned[0]?.level).toBe('warning');
    expect(check(word({ kanji: '帰る', kana: 'かえる' }))).toEqual([]);
    expect(check(word({ kanji: '持ち帰る', kana: 'もちかえる' }))).toEqual([]);
    expect(codes(check(word({ kanji: undefined, kana: 'いる' })))).toEqual(['g1-looks-g2']);
  });

  it('meaning-missing for a missing language', () => {
    const problems = check(word({ meaning: { en: ['to write'] } }));
    expect(codes(problems)).toEqual(['meaning-missing']);
    expect(problems[0]?.message).toContain('Spanish');
    expect(errors(problems)).toEqual([]);
  });

  it('likely-duplicate when the same word repeats a meaning; homophones are fine', () => {
    const dup = check(
      word({}),
      word({ id: 'kaku-2', meaning: { en: ['To write '], es: ['redactar'] } }),
    );
    expect(codes(dup)).toEqual(['likely-duplicate']);
    expect(dup[0]?.id).toBe('kaku-2');
    const iru = { kanji: undefined, kana: 'いる' };
    const homophones = check(
      word({ ...iru, id: 'iru-exist', verbGroup: 2, meaning: { en: ['to exist'] } }),
      word({ ...iru, id: 'iru-need', verbGroup: 1, meaning: { en: ['to need'] } }),
    );
    expect(codes(homophones)).not.toContain('likely-duplicate');
    const kiru = { kanji: '切る', kana: 'きる' };
    const sameGroup = check(
      word({ ...kiru, id: 'kiru-cut', meaning: { en: ['to cut'] } }),
      word({ ...kiru, id: 'kiru-hang', meaning: { en: ['to hang up'] } }),
    );
    expect(codes(sameGroup)).not.toContain('likely-duplicate');
  });
});

describe('checkDecks', () => {
  const words = [word({}).value];
  const deck = (over: Partial<Deck>): Located<Deck> => ({
    value: { id: 'verbs', name: { en: 'Verbs', es: 'Verbos' }, match: { pos: 'verb' }, ...over },
    file: 'data/decks.json',
  });

  it('passes a deck that matches', () => {
    expect(checkDecks([deck({})], words)).toEqual([]);
  });

  it('warns on a deck that matches nothing', () => {
    const problems = checkDecks([deck({ match: { tags: ['food'] } })], words);
    expect(codes(problems)).toEqual(['deck-empty']);
    expect(problems[0]?.level).toBe('warning');
  });

  it('errors on a duplicate deck id', () => {
    expect(codes(checkDecks([deck({}), deck({})], words))).toEqual(['dup-id']);
  });
});

describe('fixtures', () => {
  it('every fixture word passes with no errors or warnings', () => {
    const words = WordsFileSchema.parse(fixtures).map((value) => ({
      value,
      file: 'data/fixtures/words.json',
    }));
    expect(checkWords(words)).toEqual([]);
  });
});
