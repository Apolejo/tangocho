import { JaText } from '../../components/JaText.tsx';
import type { Word } from '../../data/schema.ts';
import { useT } from '../../i18n/hooks.ts';
import type { ConjugationForm } from '../../lib/conjugate.ts';
import { conjugationRule } from './rule.ts';

/**
 * The explanation after an answer (SPEC §9.4): the dictionary form with its reading, since the
 * rule is about the ending (§8.3), then the rule. 書く（かく）— group 1, ends in く → いて
 */
export function ConjugationRule({ word, form }: { word: Word; form: ConjugationForm }) {
  const t = useT();
  const rule = conjugationRule(word, form);
  if (rule === undefined) return null;
  return (
    <>
      <span lang="ja">
        {word.kanji === undefined ? word.kana : `${word.kanji}（${word.kana}）`}
      </span>
      {' — '}
      <JaText text={t(rule.key, rule.vars)} />
    </>
  );
}
