import { JaText } from '../../components/JaText.tsx';
import type { VerbGroup, Word } from '../../data/schema.ts';
import type { MessageKey } from '../../i18n/en.ts';
import { useT } from '../../i18n/hooks.ts';
import { groupRule, type GroupRule as Rule } from './rules.ts';

const RULE_KEYS: Record<Rule, MessageKey> = {
  g1: 'sorter_rule_g1',
  'g1-exception': 'sorter_rule_g1_exception',
  g2: 'sorter_rule_g2',
  g3: 'sorter_rule_g3',
};

/**
 * The explanation after an answer (SPEC §9.2): the dictionary form with its reading, since the
 * rule is about the ending (§8.3), then the rule. 帰る（かえる）— exception: looks like group 2, …
 */
export function GroupRule({ word }: { word: Word & { verbGroup: VerbGroup } }) {
  const t = useT();
  return (
    <>
      <span lang="ja">
        {word.kanji === undefined ? word.kana : `${word.kanji}（${word.kana}）`}
      </span>
      {' — '}
      <JaText text={t(RULE_KEYS[groupRule(word)])} />
    </>
  );
}
