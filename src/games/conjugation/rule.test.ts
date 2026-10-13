import { describe, expect, it } from 'vitest';
import fixtures from '../../../data/fixtures/words.json';
import { WordsFileSchema, type Word } from '../../data/schema.ts';
import { FORMS, type ConjugationForm } from '../../lib/conjugate.ts';
import { conjugationRule, type Rule } from './rule.ts';

const all = WordsFileSchema.parse(fixtures);
const byId = (id: string): Word => {
  const word = all.find((w) => w.id === id);
  if (word === undefined) throw new Error(`no fixture ${id}`);
  return word;
};
const verb = (kana: string, verbGroup: 1 | 2 | 3, kanji?: string) => ({
  kana,
  verbGroup,
  ...(kanji !== undefined && { kanji }),
});

const rule = (word: Pick<Word, 'kanji' | 'kana' | 'verbGroup'>, form: ConjugationForm): Rule =>
  conjugationRule(word, form) ?? { key: 'conj_rule_aru', vars: { missing: 'yes' } };
const g1 = (from: string, to: string): Rule => ({ key: 'conj_rule_g1', vars: { from, to } });

describe('conjugationRule', () => {
  it('gives each group 1 ending its own change', () => {
    const cases: [string, ConjugationForm, Rule][] = [
      ['kau', 'て', g1('う', 'って')],
      ['kaku', 'て', g1('く', 'いて')],
      ['oyogu', 'た', g1('ぐ', 'いだ')],
      ['hanasu', 'て', g1('す', 'して')],
      ['matsu', 'た', g1('つ', 'った')],
      ['shinu', 'て', g1('ぬ', 'んで')],
      ['asobu', 'た', g1('ぶ', 'んだ')],
      ['yomu', 'て', g1('む', 'んで')],
      ['kaeru', 'て', g1('る', 'って')],
      ['kaku', 'ません', g1('く', 'きません')],
      ['kau', 'ない', g1('う', 'わない')],
      ['kaku', '辞書形', g1('きます', 'く')],
    ];
    for (const [id, form, expected] of cases) expect(rule(byId(id), form), id).toEqual(expected);
  });

  it('names the exceptions', () => {
    const iku = { key: 'conj_rule_iku', vars: { to: 'って', regular: 'いて' } };
    expect(rule(byId('iku'), 'て')).toEqual(iku);
    expect(rule(byId('iku'), 'た')).toEqual({
      key: 'conj_rule_iku',
      vars: { to: 'った', regular: 'いた' },
    });
    expect(rule(verb('もっていく', 1, '持って行く'), 'て')).toEqual(iku);
    expect(rule(byId('iku'), 'ます')).toEqual(g1('く', 'きます'));
    expect(rule(byId('aru'), 'ない')).toEqual({ key: 'conj_rule_aru', vars: {} });
    expect(rule(byId('aru'), 'た')).toEqual(g1('る', 'った'));
  });

  it('drops る for group 2', () => {
    expect(rule(byId('taberu'), 'て')).toEqual({
      key: 'conj_rule_g2',
      vars: { from: 'る', to: 'て' },
    });
    expect(rule(byId('kiru-wear'), 'ませんでした')).toEqual({
      key: 'conj_rule_g2',
      vars: { from: 'る', to: 'ませんでした' },
    });
    expect(rule(byId('miru'), '辞書形')).toEqual({
      key: 'conj_rule_g2',
      vars: { from: 'ます', to: 'る' },
    });
  });

  it('changes する and くる for group 3, compounds included', () => {
    const g3 = (from: string, to: string): Rule => ({ key: 'conj_rule_g3', vars: { from, to } });
    expect(rule(byId('suru'), 'て')).toEqual(g3('する', 'して'));
    expect(rule(byId('benkyou-suru'), 'ない')).toEqual(g3('する', 'しない'));
    expect(rule(verb('コピーする', 3), 'た')).toEqual(g3('する', 'した'));
    expect(rule(byId('kuru'), 'ない')).toEqual(g3('くる', 'こない'));
    expect(rule(byId('kuru'), 'て')).toEqual(g3('くる', 'きて'));
    expect(rule(verb('もってくる', 3, '持って来る'), 'ない')).toEqual(g3('くる', 'こない'));
    expect(rule(verb('むかえにくる', 3, '迎えに来る'), 'ます')).toEqual(g3('くる', 'きます'));
    expect(rule(byId('kuru'), '辞書形')).toEqual(g3('きます', 'くる'));
    expect(rule(byId('suru'), '辞書形')).toEqual(g3('します', 'する'));
  });

  it('has a rule for every fixture verb and form', () => {
    for (const word of all.filter((w) => w.pos === 'verb')) {
      for (const form of FORMS) expect(conjugationRule(word, form), word.id).toBeDefined();
    }
  });
});
