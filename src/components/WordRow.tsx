import type { Word } from '../data/schema.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { pickLocalized } from '../i18n/localized.ts';
import { furiganaFor } from '../lib/furigana.ts';
import { Ruby } from './Ruby.tsx';
import styles from './WordRow.module.css';

/** One line of the notebook: the word with furigana, its meanings, verb group and note. */
export function WordRow({ word }: { word: Word }) {
  const { lang } = useLang();
  const t = useT();
  const meaning = pickLocalized(word.meaning, lang);
  const note = word.note === undefined ? undefined : pickLocalized(word.note, lang);
  return (
    <li className={styles.row} data-word-id={word.id}>
      <Ruby pairs={furiganaFor(word)} className={styles.word} />
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
      {note !== undefined && (
        <span className={styles.note} lang={note.lang}>
          {note.value}
        </span>
      )}
    </li>
  );
}
