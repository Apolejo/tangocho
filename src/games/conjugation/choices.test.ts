import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../../data/schema.ts';
import { conjugate, FORMS, type ConjugationForm } from '../../lib/conjugate.ts';
import { answerKey } from '../../lib/kana.ts';
import { mulberry32 } from '../../lib/random.ts';
import { buildChoices, CHOICE_COUNT, mistakes } from './choices.ts';
import { isConjugable } from '../../lib/verbs.ts';
import { written } from './drill.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};

/** Verbs the fixtures don't have, for the special cases (SPEC §11). */
const verb = (id: string, kana: string, verbGroup: 1 | 2 | 3, kanji?: string): Word => ({
  id,
  kana,
  ...(kanji !== undefined && { kanji }),
  pos: 'verb',
  verbGroup,
  meaning: { en: [id] },
  tags: [],
  added: '2026-10-13',
});
const extra = [
  verb('kopii-suru', 'コピーする', 3),
  verb('motte-kuru', 'もってくる', 3, '持って来る'),
  verb('motte-iku', 'もっていく', 1, '持って行く'),
  verb('mukae-ni-kuru', 'むかえにくる', 3, '迎えに来る'),
];
const verbs = [...all.filter(isConjugable), ...extra];

/** Every option as the question shows it: kana when written forms would collide. */
const shown = (word: Word, form: ConjugationForm, seed: number): string[] => {
  const choices = buildChoices({ word, form, rng: mulberry32(seed) });
  if (choices === undefined) throw new Error(`no choices for ${word.id} ${form}`);
  return choices.options.map((o) => (choices.kanaOnly ? o.form.kana : written(o.form)));
};

/** Every distractor any seed offers for a verb and form, as written. */
const offered = (word: Word, form: ConjugationForm): Set<string> => {
  const out = new Set<string>();
  for (let seed = 0; seed < 60; seed++) {
    const choices = buildChoices({ word, form, rng: mulberry32(seed) });
    for (const o of choices?.options ?? []) if (!o.correct) out.add(written(o.form));
  }
  return out;
};

describe('buildChoices', () => {
  it('covers every fixture verb, the special cases included', () => {
    expect(verbs.length).toBe(all.filter((w) => w.pos === 'verb').length + extra.length);
  });

  it('always gives four options, exactly one right, none alike', () => {
    for (const word of verbs) {
      for (const form of FORMS) {
        for (let seed = 0; seed < 20; seed++) {
          const choices = buildChoices({ word, form, rng: mulberry32(seed) });
          expect(choices).toBeDefined();
          if (choices === undefined) continue;
          const { options, kanaOnly } = choices;
          const where = `${word.id} ${form} seed ${seed}`;
          expect(options, where).toHaveLength(CHOICE_COUNT);
          const right = options.filter((o) => o.correct);
          expect(right, where).toHaveLength(1);
          expect(right[0]?.form, where).toEqual(conjugate(word, form));
          // never a second right answer: no other option reads like the answer
          const keys = options.map((o) => answerKey(o.form.kana));
          expect(new Set(keys).size, where).toBe(CHOICE_COUNT);
          // never two alike as shown
          const texts = options.map((o) => (kanaOnly ? o.form.kana : written(o.form)));
          expect(new Set(texts).size, where).toBe(CHOICE_COUNT);
        }
      }
    }
  });

  it('is the same for the same seed', () => {
    expect(shown(byId('kaku'), 'て', 3)).toEqual(shown(byId('kaku'), 'て', 3));
  });

  it('offers the wrong て/た sound change', () => {
    expect(offered(byId('kaku'), 'て')).toEqual(
      new Set(['書って', '書きて', '書して', '書んで', '書いで']),
    );
    expect(offered(byId('oyogu'), 'た')).toContain('泳いた');
    expect(offered(byId('yomu'), 'て')).toContain('読って');
  });

  it('offers another group’s rule', () => {
    expect(offered(byId('kaeru'), 'ない')).toContain('帰ない');
    expect(offered(byId('kiru-cut'), 'て')).toContain('切て');
    expect(offered(byId('taberu'), 'て')).toContain('食べって');
    expect(offered(byId('kiru-wear'), 'ます')).toContain('着ります');
    expect(offered(byId('suru'), 'ない')).toEqual(new Set(['すらない', 'すない', 'するない']));
  });

  it('offers the exceptions as if they weren’t', () => {
    expect(offered(byId('iku'), 'て')).toContain('行いて');
    expect(offered(byId('iku'), 'た')).toContain('行いた');
    expect(offered(verbs.find((w) => w.id === 'motte-iku') as Word, 'て')).toContain(
      '持って行いて',
    );
    expect(offered(byId('aru'), 'ない')).toContain('あらない');
  });

  it('offers forms built on the wrong stem', () => {
    expect([...offered(byId('kaku'), 'ない')]).toEqual(
      expect.arrayContaining(['書きない', '書くない']),
    );
    expect(offered(byId('kau'), 'ない')).toContain('買あない');
    expect(offered(byId('kaku'), 'ます')).toContain('書くます');
    expect(offered(byId('kaku'), 'ません')).toContain('書かません');
  });

  it('offers the wrong way back to the dictionary form', () => {
    expect(offered(byId('kaku'), '辞書形')).toContain('書きる');
    expect(offered(byId('okiru'), '辞書形')).toContain('起く');
    expect(offered(byId('kaeru'), '辞書形')).toContain('帰りる');
  });

  it('never offers the form the verb is shown in', () => {
    // a 辞書形 question shows the ます form; a ます question shows the dictionary form
    expect(offered(byId('taberu'), '辞書形')).not.toContain('食べます');
    expect(offered(byId('taberu'), 'ます')).not.toContain('食べる');
  });

  it('shows 来る questions in kana when two options would look the same', () => {
    const kuru = byId('kuru');
    const nai = [0, 1, 2, 3, 4, 5].map((seed) =>
      buildChoices({ word: kuru, form: 'ない', rng: mulberry32(seed) }),
    );
    const withKinai = nai.filter((c) => c?.options.some((o) => o.form.kana === 'きない'));
    expect(withKinai.length).toBeGreaterThan(0);
    for (const choices of withKinai) expect(choices?.kanaOnly).toBe(true);
    // a verb whose kanji always reads the same never needs it
    for (let seed = 0; seed < 20; seed++) {
      expect(
        buildChoices({ word: byId('kaku'), form: 'ない', rng: mulberry32(seed) })?.kanaOnly,
      ).toBe(false);
    }
  });
});

describe('mistakes', () => {
  it('never includes a lone kana', () => {
    for (const word of verbs) {
      for (const form of FORMS) {
        for (const m of mistakes(word, form)) expect(m.kana.length).toBeGreaterThan(1);
      }
    }
  });
});
