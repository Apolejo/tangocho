import type { Word } from '../../data/schema.ts';
import { conjugate, type ConjugationForm } from '../../lib/conjugate.ts';

/**
 * The rule shown after a conjugation answer (SPEC §9.4): "group 1, ends in く → いて". Pure: it
 * reads the engine's output, so it can never disagree with the answer. Explanations quote the
 * dictionary form (SPEC §8.3); that part is the component's.
 */

export type RuleKey =
  'conj_rule_g1' | 'conj_rule_g2' | 'conj_rule_g3' | 'conj_rule_iku' | 'conj_rule_aru';

export interface Rule {
  key: RuleKey;
  /** Kana pieces for the message: what the ending was and what it becomes. */
  vars: Record<string, string>;
}

type Verb = Pick<Word, 'kanji' | 'kana' | 'verbGroup'>;

const KEYS = { 1: 'conj_rule_g1', 2: 'conj_rule_g2', 3: 'conj_rule_g3' } as const;

/**
 * The ending a group's rule replaces: the last kana (group 1), る (group 2), する or くる
 * (group 3).
 */
function rootEnding(kana: string, group: 1 | 2 | 3): string {
  return group === 1 ? kana.slice(-1) : group === 2 ? 'る' : kana.slice(-2);
}

export function conjugationRule(word: Verb, form: ConjugationForm): Rule | undefined {
  const group = word.verbGroup;
  const dict = conjugate(word, '辞書形');
  const target = conjugate(word, form);
  if (group === undefined || dict === undefined || target === undefined) return undefined;
  const from = rootEnding(dict.kana, group);
  const stem = dict.kana.slice(0, dict.kana.length - from.length);

  // back to the dictionary form: ます's ending → the dictionary ending
  if (form === '辞書形') {
    const masu = conjugate(word, 'ます');
    if (masu === undefined) return undefined;
    return { key: KEYS[group], vars: { from: masu.kana.slice(stem.length), to: from } };
  }

  if (group === 1 && form === 'ない' && word.kana === 'ある') {
    return { key: 'conj_rule_aru', vars: {} };
  }
  const to = target.kana.slice(stem.length);
  // 行く (and 持っていく): って/った where く would take いて/いた
  if (group === 1 && from === 'く' && (form === 'て' || form === 'た') && to.startsWith('っ')) {
    return { key: 'conj_rule_iku', vars: { to, regular: form === 'て' ? 'いて' : 'いた' } };
  }
  return { key: KEYS[group], vars: { from, to } };
}
