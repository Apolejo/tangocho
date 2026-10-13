import { useEffect, useId, useRef } from 'react';
import type { Word } from '../data/schema.ts';
import { FORM_LABELS } from '../i18n/forms.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { meaningText } from '../i18n/localized.ts';
import { conjugate, FORMS } from '../lib/conjugate.ts';
import { furiganaFor } from '../lib/furigana.ts';
import { ReportLink } from '../reports/ReportLink.tsx';
import { Ruby } from './Ruby.tsx';
import styles from './VerbSheet.module.css';

/**
 * A verb's eight forms (SPEC §7.2, §11), each with its ⚑ (§5.7): a bottom sheet on a phone, a
 * dialog on the computer. A native modal <dialog>, so focus moves in, Esc closes it and the page
 * behind is inert. ✕ or a tap outside closes it too.
 */
export function VerbSheet({
  word,
  from,
  onClose,
}: {
  word: Word;
  /** Where its reports say they were made. */
  from: string;
  onClose(): void;
}) {
  const t = useT();
  const { lang } = useLang();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // removed from the page, an open dialog closes by itself; StrictMode runs this twice
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const close = () => ref.current?.close();
  const meaning = meaningText(word, lang);
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      // the dialog itself is only hit outside its content: the backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-verb-sheet={word.id}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title} lang="ja">
            {word.kanji === undefined ? word.kana : `${word.kanji}（${word.kana}）`}
          </h2>
          {word.verbGroup !== undefined && (
            <span className={styles.badge}>{t('group_badge', { n: word.verbGroup })}</span>
          )}
          <button type="button" className={styles.close} onClick={close}>
            <span aria-hidden="true">✕</span>
            <span className="visually-hidden">{t('forms_close')}</span>
          </button>
        </header>
        {meaning.text !== '' && (
          <p className={styles.meaning} lang={meaning.lang}>
            {meaning.text}
          </p>
        )}
        <table className={styles.forms}>
          <caption className="visually-hidden">{t('forms_title')}</caption>
          <tbody>
            {FORMS.map((form) => {
              const conjugated = conjugate(word, form);
              if (conjugated === undefined) return null;
              const answer =
                conjugated.kanji === undefined
                  ? conjugated.kana
                  : `${conjugated.kanji}（${conjugated.kana}）`;
              return (
                <tr key={form} data-form={form}>
                  <th scope="row" lang="ja" className={styles.label}>
                    {FORM_LABELS[form]}
                  </th>
                  <td className={styles.form}>
                    <Ruby pairs={furiganaFor(conjugated)} className={styles.formJa} />
                  </td>
                  <td className={styles.flag}>
                    <ReportLink report={{ word, from, form, answer }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
