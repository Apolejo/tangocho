import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type VerbGroup, type Word } from '../../data/schema.ts';
import { checkGroup, groupRule, isSortable, type GroupRule } from './rules.ts';

const all = WordsFileSchema.parse(fixtures);

const verb = (
  over: Partial<Word> & Pick<Word, 'id' | 'kana'> & { verbGroup: VerbGroup },
): Word & { verbGroup: VerbGroup } => ({
  pos: 'verb',
  meaning: { en: [over.id], es: [over.id] },
  tags: [],
  added: '2026-10-08',
  ...over,
});

const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture word ${id}`);
  return word;
};

describe('groupRule on every fixture verb', () => {
  const expected: Record<string, GroupRule> = {
    kau: 'g1',
    kaku: 'g1',
    oyogu: 'g1',
    hanasu: 'g1',
    matsu: 'g1',
    shinu: 'g1',
    asobu: 'g1',
    yomu: 'g1',
    kaeru: 'g1-exception',
    'kiru-cut': 'g1-exception',
    hairu: 'g1-exception',
    iku: 'g1',
    aru: 'g1',
    taberu: 'g2',
    miru: 'g2',
    okiru: 'g2',
    neru: 'g2',
    'kiru-wear': 'g2',
    suru: 'g3',
    kuru: 'g3',
    'benkyou-suru': 'g3',
  };

  it('covers exactly the fixture verbs', () => {
    expect(all.filter(isSortable).map((w) => w.id)).toEqual(Object.keys(expected));
  });

  for (const [id, rule] of Object.entries(expected)) {
    it(`${id} → ${rule}`, () => {
      const word = byId(id);
      if (!isSortable(word)) throw new Error(`${id} is not a verb`);
      expect(groupRule(word)).toBe(rule);
    });
  }
});

describe('groupRule on special cases', () => {
  it('gives the exception line to a kana-only group 1 verb that looks like group 2', () => {
    expect(groupRule(verb({ id: 'shaberu', kana: 'しゃべる', verbGroup: 1 }))).toBe('g1-exception');
  });

  it('keeps the plain group 1 rule for る verbs that end in -aru/-uru/-oru', () => {
    expect(groupRule(verb({ id: 'okuru', kanji: '送る', kana: 'おくる', verbGroup: 1 }))).toBe(
      'g1',
    );
    expect(groupRule(verb({ id: 'wakaru', kanji: '分かる', kana: 'わかる', verbGroup: 1 }))).toBe(
      'g1',
    );
    expect(groupRule(verb({ id: 'toru', kanji: '取る', kana: 'とる', verbGroup: 1 }))).toBe('g1');
  });

  it('follows the stored group, never the ending', () => {
    // いる "to need" is group 1 and いる "to exist" group 2: same kana, different rules
    expect(groupRule(verb({ id: 'iru-need', kanji: '要る', kana: 'いる', verbGroup: 1 }))).toBe(
      'g1-exception',
    );
    expect(groupRule(verb({ id: 'iru', kana: 'いる', verbGroup: 2 }))).toBe('g2');
    expect(
      groupRule(verb({ id: 'mottekuru', kanji: '持ってくる', kana: 'もってくる', verbGroup: 3 })),
    ).toBe('g3');
  });
});

describe('checkGroup', () => {
  it('is right only for the stored group', () => {
    const kaeru = byId('kaeru');
    expect(checkGroup(kaeru, 1)).toBe(true);
    expect(checkGroup(kaeru, 2)).toBe(false);
    expect(checkGroup(kaeru, 3)).toBe(false);
    expect(checkGroup(byId('kuru'), 3)).toBe(true);
  });
});

describe('isSortable', () => {
  it('takes verbs with a group and nothing else', () => {
    expect(isSortable(byId('taberu'))).toBe(true);
    const nouns = all.filter((w) => w.pos !== 'verb');
    expect(nouns.length).toBeGreaterThan(0);
    expect(nouns.some(isSortable)).toBe(false);
  });
});
