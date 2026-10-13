import { useEffect, useRef, useState } from 'react';
import { MeaningPeek } from '../../components/MeaningPeek.tsx';
import { Ruby } from '../../components/Ruby.tsx';
import { VERB_GROUPS, type VerbGroup } from '../../data/schema.ts';
import { useT } from '../../i18n/hooks.ts';
import { furiganaFor } from '../../lib/furigana.ts';
import { displayForm } from '../../lib/verbs.ts';
import type { QuestionProps } from '../types.ts';
import { GroupRule } from './GroupRule.tsx';
import { checkGroup, isSortable } from './rules.ts';
import styles from './SorterQuestion.module.css';

/**
 * One verb group question (SPEC §9.2): a verb in ます form, three buttons for groups 1–3 (or
 * keys 1–3). The answer carries the rule that decides the group.
 */
export function SorterQuestion({ word, options, onAnswer }: QuestionProps) {
  const t = useT();
  const [picked, setPicked] = useState<VerbGroup | null>(null);
  const answered = useRef(false);

  const choose = (group: VerbGroup) => {
    if (answered.current || !isSortable(word)) return;
    answered.current = true;
    setPicked(group);
    onAnswer({
      correct: checkGroup(word, group),
      hinted: false,
      given: t('group_badge', { n: group }),
      expected: t('group_badge', { n: word.verbGroup }),
      explanation: <GroupRule word={word} />,
    });
  };

  useEffect(() => {
    if (picked !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const group = VERB_GROUPS.find((g) => String(g) === e.key);
      if (group === undefined) return;
      e.preventDefault();
      choose(group);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shown = displayForm(word);
  return (
    <div className={styles.question}>
      <div className={styles.prompt} data-sorter-prompt data-word-id={word.id}>
        <MeaningPeek word={word} label={shown.kanji ?? shown.kana}>
          <Ruby
            pairs={furiganaFor(shown)}
            readings={options.furigana}
            className={`${styles.promptJa} ${options.furigana ? styles.withRuby : ''}`}
          />
        </MeaningPeek>
      </div>
      <p className={styles.ask}>{t('sorter_ask')}</p>
      <ol className={styles.groups}>
        {VERB_GROUPS.map((group) => {
          const state =
            picked === null
              ? undefined
              : group === word.verbGroup
                ? 'correct'
                : picked === group
                  ? 'wrong'
                  : 'other';
          return (
            <li key={group}>
              <button
                type="button"
                className={styles.group}
                data-group-choice={group}
                data-state={state}
                disabled={picked !== null}
                aria-keyshortcuts={String(group)}
                onClick={() => choose(group)}
              >
                <span className={styles.number} aria-hidden="true">
                  {group}
                </span>
                <span className={styles.label}>{t('group_badge', { n: group })}</span>
                {(state === 'correct' || state === 'wrong') && (
                  <span className={styles.mark} data-mark={state} aria-hidden="true">
                    {state === 'correct' ? '◯' : '✕'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
