import { useLang, useT } from '../i18n/hooks.ts';
import { displayForm } from '../lib/verbs.ts';
import { reportUrl, type Report } from './report.ts';
import styles from './ReportLink.module.css';

/**
 * The ⚑ on a word (SPEC §5.7): opens a prefilled new issue on GitHub in a new tab. Nothing is
 * sent until the issue is submitted there.
 */
export function ReportLink({ report, className }: { report: Report; className?: string }) {
  const { lang } = useLang();
  const t = useT();
  const shown = displayForm(report.word);
  return (
    <a
      href={reportUrl(report, lang)}
      target="_blank"
      rel="noopener noreferrer"
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
