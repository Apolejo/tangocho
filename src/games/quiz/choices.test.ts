import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../../data/schema.ts';
import type { Lang } from '../../i18n/lang.ts';
import { mulberry32 } from '../../lib/random.ts';
import type { Skill } from '../types.ts';
import {
  buildChoices,
  conflicts,
  meaningText,
  quizAvailable,
  writtenForm,
  type Choice,
} from './choices.ts';

const all = WordsFileSchema.parse(fixtures);

const word = (over: Partial<Word> & Pick<Word, 'id'>): Word => ({
  kana: 'かみ',
  pos: 'noun',
  meaning: { en: [over.id], es: [over.id] },
  tags: [],
  added: '2026-10-08',
  ...over,
});

function shownTexts(choices: Choice[], skill: Skill, lang: Lang): string[] {
  return choices.map((c) =>
    skill === 'recall' ? writtenForm(c.word) : meaningText(c.word, lang).text,
  );
}

describe('buildChoices on every fixture word', () => {
  for (const skill of ['meaning', 'recall'] as const) {
    for (const lang of ['en', 'es'] as const) {
      it(`${skill} in ${lang}: four options, one correct, no duplicates, no second answer`, () => {
        for (const [i, target] of all.entries()) {
          for (const seed of [1, 2, 3]) {
            const choices = buildChoices({
              target,
              skill,
              pool: all,
              allWords: all,
              lang,
              rng: mulberry32(seed * 1000 + i),
            });
            expect(choices).toHaveLength(4);
            expect(choices.filter((c) => c.correct).map((c) => c.word.id)).toEqual([target.id]);
            expect(new Set(shownTexts(choices, skill, lang)).size).toBe(4);
            for (const c of choices) {
              if (!c.correct) expect(conflicts(target, c.word)).toBe(false);
            }
          }
        }
      });
    }
  }

  it('is deterministic for a seed', () => {
    const input = { skill: 'meaning' as const, pool: all, allWords: all, lang: 'en' as const };
    const target = all[0] as Word;
    const a = buildChoices({ ...input, target, rng: mulberry32(5) });
    const b = buildChoices({ ...input, target, rng: mulberry32(5) });
    expect(a.map((c) => c.word.id)).toEqual(b.map((c) => c.word.id));
  });
});

describe('a distractor is never a second right answer', () => {
  const iru = word({
    id: 'iru',
    kana: 'いる',
    pos: 'verb',
    verbGroup: 2,
    meaning: { en: ['to exist (animate)'], es: ['estar'] },
  });
  const aru = word({
    id: 'aru',
    kana: 'ある',
    pos: 'verb',
    verbGroup: 1,
    meaning: { en: ['to exist'], es: ['haber'] },
  });
  const paper = word({ id: 'kami-paper', kana: 'かみ', meaning: { en: ['paper'], es: ['papel'] } });
  const god = word({ id: 'kami-god', kana: 'かみ', meaning: { en: ['god'], es: ['dios'] } });
  const take = word({
    id: 'toru-take',
    kanji: '取る',
    kana: 'とる',
    pos: 'verb',
    verbGroup: 1,
    meaning: { en: ['to take'], es: ['tomar'] },
  });
  const photo = word({
    id: 'toru-photo',
    kanji: '撮る',
    kana: 'とる',
    pos: 'verb',
    verbGroup: 1,
    meaning: { en: ['to take a photo'], es: ['tomar (fotos, videos)'] },
  });

  it('flags shared glosses in either language, ignoring parenthesized details', () => {
    expect(conflicts(iru, aru)).toBe(true);
    expect(conflicts(iru, paper)).toBe(false);
    expect(conflicts(aru, word({ id: 'x', meaning: { en: ['To exist '] } }))).toBe(true);
    expect(conflicts(take, photo)).toBe(true);
    expect(conflicts(take, word({ id: 'y', meaning: { es: ['coger', 'Tomar'] } }))).toBe(true);
  });

  it('flags words that look the same in Japanese', () => {
    expect(conflicts(paper, god)).toBe(true);
    expect(conflicts(paper, word({ id: 'kami-hair', kanji: '髪', kana: 'かみ' }))).toBe(false);
  });

  it('keeps conflicting words out of the options', () => {
    const fillers = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      word({ id, kana: `${id}`, meaning: { en: [`filler ${id}`] } }),
    );
    const words = [paper, god, take, photo, ...fillers];
    for (let seed = 0; seed < 50; seed++) {
      for (const skill of ['meaning', 'recall'] as const) {
        const forPaper = buildChoices({
          target: paper,
          skill,
          pool: words,
          allWords: words,
          lang: 'en',
          rng: mulberry32(seed),
        });
        expect(forPaper.map((c) => c.word.id)).not.toContain('kami-god');
        const forTake = buildChoices({
          target: take,
          skill,
          pool: words,
          allWords: words,
          lang: 'es',
          rng: mulberry32(seed),
        });
        expect(forTake.map((c) => c.word.id)).not.toContain('toru-photo');
      }
    }
  });
});

describe('distractor preference', () => {
  const target = word({ id: 'sensei', kanji: '先生', kana: 'せんせい' });
  const deckNouns = ['n1', 'n2', 'n3'].map((id) => word({ id, kana: 'あ' + id }));
  const deckVerbs = ['v1', 'v2', 'v3'].map((id) =>
    word({ id, kana: 'か' + id, pos: 'verb', verbGroup: 2 }),
  );
  const otherNouns = ['o1', 'o2', 'o3'].map((id) => word({ id, kana: 'さ' + id }));
  const otherVerbs = ['w1', 'w2', 'w3'].map((id) =>
    word({ id, kana: 'た' + id, pos: 'verb', verbGroup: 2 }),
  );
  const allWords = [target, ...deckNouns, ...deckVerbs, ...otherNouns, ...otherVerbs];
  const ids = (choices: Choice[]) =>
    choices
      .filter((c) => !c.correct)
      .map((c) => c.word.id)
      .sort();

  it('takes the same part of speech from the selected decks first', () => {
    const pool = [target, ...deckNouns, ...deckVerbs];
    for (let seed = 0; seed < 20; seed++) {
      const choices = buildChoices({
        target,
        skill: 'meaning',
        pool,
        allWords,
        lang: 'en',
        rng: mulberry32(seed),
      });
      expect(ids(choices)).toEqual(['n1', 'n2', 'n3']);
    }
  });

  it('then the same part of speech from any deck, before other parts of speech', () => {
    const pool = [target, deckNouns[0] as Word, ...deckVerbs];
    for (let seed = 0; seed < 20; seed++) {
      const choices = buildChoices({
        target,
        skill: 'recall',
        pool,
        allWords,
        lang: 'en',
        rng: mulberry32(seed),
      });
      const picked = ids(choices);
      expect(picked).toContain('n1');
      expect(picked.every((id) => id.startsWith('n') || id.startsWith('o'))).toBe(true);
    }
  });

  it('falls back to any word when nothing shares the part of speech', () => {
    const lonely = word({ id: 'tokidoki', kana: 'ときどき', pos: 'adverb' });
    const words = [lonely, ...deckVerbs];
    const choices = buildChoices({
      target: lonely,
      skill: 'meaning',
      pool: [lonely],
      allWords: words,
      lang: 'en',
      rng: mulberry32(1),
    });
    expect(ids(choices)).toEqual(['v1', 'v2', 'v3']);
  });
});

describe('meaningText', () => {
  it('joins every gloss and falls back to the other language', () => {
    const w = word({ id: 'miru', meaning: { en: ['to see', 'to watch'], es: [] } });
    expect(meaningText(w, 'en')).toEqual({ lang: 'en', text: 'to see, to watch' });
    expect(meaningText(w, 'es')).toEqual({ lang: 'en', text: 'to see, to watch' });
  });
});

describe('quizAvailable', () => {
  const m = (id: string, en: string) => word({ id, kana: id, meaning: { en: [en] } });

  it('needs four distinct meanings in the whole list', () => {
    const three = [m('a', 'one'), m('b', 'two'), m('c', 'three'), m('d', 'Three')];
    expect(quizAvailable(three, 'en')).toBe(false);
    expect(quizAvailable([...three, m('e', 'four')], 'en')).toBe(true);
    expect(quizAvailable(all, 'en')).toBe(true);
    expect(quizAvailable(all, 'es')).toBe(true);
  });
});
