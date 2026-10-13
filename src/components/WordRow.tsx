import { useState } from 'react';
import type { Word } from '../data/schema.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { pickLocalized } from '../i18n/localized.ts';
import { furiganaFor } from '../lib/furigana.ts';
import { displayForm, isConjugable } from '../lib/verbs.ts';
import { ReportLink } from '../reports/ReportLink.tsx';
import { Ruby } from './Ruby.tsx';
import { VerbSheet } from './VerbSheet.tsx';
import styles from './WordRow.module.css';

/**
 * One line of the notebook: the word (verbs in ます form) with furigana, meanings, group and note,
 * and its ⚑ (SPEC §5.7). Tapping a verb shows its forms (§7.2).
 */
export function WordRow({
  word,
  from,
}: {
  word: Word;
  /** Where reports say they were made. */ from?: string;
}) {
  const { lang } = useLang();
  const t = useT();
  const [formsOpen, setFormsOpen] = useState(false);
  const meaning = pickLocalized(word.meaning, lang);
  const note = word.note === undefined ? undefined : pickLocalized(word.note, lang);
  const shown = displayForm(word);
  const ruby = <Ruby pairs={furiganaFor(shown)} className={styles.ja} />;
  const place = from ?? t('nav_notebook');
  return (
    <li className={styles.row} data-word-id={word.id}>
      {isConjugable(word) ? (
        <button
          type="button"
          className={`${styles.word} ${styles.verb}`}
          aria-haspopup="dialog"
          aria-label={t('forms_show', { word: shown.kanji ?? shown.kana })}
          onClick={() => setFormsOpen(true)}
          data-show-forms
        >
          {ruby}
          <span className={styles.more} aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        <span className={styles.word}>{ruby}</span>
      )}
      {meaning !== undefined && (
        <span className={styles.meaning} lang={meaning.lang}>
          {meaning.value.join(', ')}
        </span>
      )}
      {word.verbGroup !== undefined && (
        <span className={styles.badge} aria-label={t('group_badge', { n: word.verbGroup })}>
          {t('group_abbr', { n: word.verbGroup })}
        </span>
      )}
      <ReportLink className={styles.report} report={{ word, from: place }} />
      {note !== undefined && (
        <span className={styles.note} lang={note.lang}>
          {note.value}
        </span>
      )}
      {formsOpen && <VerbSheet word={word} from={place} onClose={() => setFormsOpen(false)} />}
    </li>
  );
}
