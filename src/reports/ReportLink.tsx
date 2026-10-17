import { useLang, useT } from '../i18n/hooks.ts';
import { displayForm } from '../lib/verbs.ts';
import { reportMailto, type Report } from './report.ts';
import styles from './ReportLink.module.css';

/**
 * The ⚑ on a word (SPEC §5.7): opens a prefilled email to the report address in the reporter's
 * mail app. Nothing is sent until they send it there. No `target`: a mailto: in a new tab leaves
 * a blank one behind in some desktop browsers.
 */
export function ReportLink({ report, className }: { report: Report; className?: string }) {
  const { lang } = useLang();
  const t = useT();
  const shown = displayForm(report.word);
  return (
    <a
      href={reportMailto(report, lang)}
      className={`${styles.flag} ${className ?? ''}`}
      aria-label={t('report_label', { word: shown.kanji ?? shown.kana })}
      data-report={report.word.id}
      data-report-form={report.form}
    >
      {/* ⚑ as a drawing: the glyph is missing from the app's fonts and differs per system */}
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4 1.5v13" />
        <path d="M4 2.5h7.5l-2 3 2 3H4" />
      </svg>
    </a>
  );
}
