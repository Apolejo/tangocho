import { useId } from 'react';
import type { Word } from '../data/schema.ts';
import { FORM_LABELS } from '../i18n/forms.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { meaningText } from '../i18n/localized.ts';
import { conjugate, FORMS } from '../lib/conjugate.ts';
import { furiganaFor } from '../lib/furigana.ts';
import { ReportLink } from '../reports/ReportLink.tsx';
import { Ruby } from './Ruby.tsx';
import { Sheet } from './Sheet.tsx';
import sheet from './Sheet.module.css';
import styles from './VerbSheet.module.css';

/**
 * A verb's eight forms (SPEC §7.2, §11), each with its ⚑ (§5.7), in a sheet: a bottom sheet on a
 * phone, a dialog on the computer.
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
  const titleId = useId();
  const meaning = meaningText(word, lang);
  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      header={
        <>
          <h2 id={titleId} className={`${sheet.title} ${styles.title}`} lang="ja">
            {word.kanji === undefined ? word.kana : `${word.kanji}（${word.kana}）`}
          </h2>
          {word.verbGroup !== undefined && (
            <span className={styles.badge}>{t('group_badge', { n: word.verbGroup })}</span>
          )}
        </>
      }
    >
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
    </Sheet>
  );
}
