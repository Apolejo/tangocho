import { describe, expect, it } from 'vitest';
import fixtures from '../../data/fixtures/words.json';
import { WordsFileSchema, type VerbGroup, type Word } from '../data/schema.ts';
import { furiganaFor, placeFurigana } from './furigana.ts';
import { displayForm, masuForm } from './verbs.ts';

const masu = (kanji: string | undefined, kana: string, verbGroup: VerbGroup) =>
  masuForm({ kanji, kana, verbGroup });

describe('masuForm', () => {
  it('group 1: every ending', () => {
    const rows: [string, string, string, string][] = [
      ['買う', 'かう', '買います', 'かいます'],
      ['書く', 'かく', '書きます', 'かきます'],
      ['泳ぐ', 'およぐ', '泳ぎます', 'およぎます'],
      ['話す', 'はなす', '話します', 'はなします'],
      ['待つ', 'まつ', '待ちます', 'まちます'],
      ['死ぬ', 'しぬ', '死にます', 'しにます'],
      ['遊ぶ', 'あそぶ', '遊びます', 'あそびます'],
      ['読む', 'よむ', '読みます', 'よみます'],
      ['帰る', 'かえる', '帰ります', 'かえります'],
      ['行く', 'いく', '行きます', 'いきます'],
    ];
    for (const [kanji, kana, kanjiMasu, kanaMasu] of rows) {
      expect(masu(kanji, kana, 1), kanji).toEqual({ kanji: kanjiMasu, kana: kanaMasu });
    }
    expect(masu(undefined, 'ある', 1)).toEqual({ kana: 'あります' });
  });

  it('group 2: drop る', () => {
    expect(masu('食べる', 'たべる', 2)).toEqual({ kanji: '食べます', kana: 'たべます' });
    expect(masu('見る', 'みる', 2)).toEqual({ kanji: '見ます', kana: 'みます' });
    expect(masu('着る', 'きる', 2)).toEqual({ kanji: '着ます', kana: 'きます' });
  });

  it('group 3: する, 来る and their compounds', () => {
    expect(masu(undefined, 'する', 3)).toEqual({ kana: 'します' });
    expect(masu('勉強する', 'べんきょうする', 3)).toEqual({
      kanji: '勉強します',
      kana: 'べんきょうします',
    });
    expect(masu('来る', 'くる', 3)).toEqual({ kanji: '来ます', kana: 'きます' });
    expect(masu(undefined, 'くる', 3)).toEqual({ kana: 'きます' });
    expect(masu('持ってくる', 'もってくる', 3)).toEqual({
      kanji: '持ってきます',
      kana: 'もってきます',
    });
  });

  it('refuses shapes that do not fit the group', () => {
    expect(masu('書く', 'かく', 2)).toBeUndefined();
    expect(masu('食べる', 'たべ', 2)).toBeUndefined();
    expect(masu('書く', 'かく', 3)).toBeUndefined();
    expect(masu('書く', 'かう', 1)).toBeUndefined();
    expect(masuForm({ kanji: '書く', kana: 'かく', verbGroup: undefined })).toBeUndefined();
  });
});

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

  it('every fixture verb has a ます form whose furigana places', () => {
    for (const word of WordsFileSchema.parse(fixtures)) {
      if (word.pos !== 'verb') continue;
      const shown = masuForm(word);
      expect(shown, word.id).toBeDefined();
      if (shown?.kanji !== undefined) {
        expect(placeFurigana(shown.kanji, shown.kana).ok, word.id).toBe(true);
      }
    }
  });
});
