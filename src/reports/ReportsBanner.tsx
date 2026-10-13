import { useEffect, useState } from 'react';
import { useT } from '../i18n/hooks.ts';
import { openReportsAtLaunch } from './count.ts';
import { OPEN_REPORTS_PAGE } from './report.ts';
import styles from './ReportsBanner.module.css';

/**
 * "2 open word reports" (SPEC §5.7), linking to them on GitHub. Asked once per launch; offline,
 * on any failure or with none open, nothing shows. ✕ hides it until the next launch.
 */
export function ReportsBanner({ onHide }: { onHide(): void }) {
  const t = useT();
  const [count, setCount] = useState<number>();

  useEffect(() => {
    let alive = true;
    void openReportsAtLaunch().then((n) => {
      if (alive) setCount(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (count === undefined || count === 0) return null;
  return (
    <aside className={styles.banner} aria-label={t('reports_label')} data-reports-banner>
      <a href={OPEN_REPORTS_PAGE} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {t(count === 1 ? 'reports_open_one' : 'reports_open_other', { n: count })}
      </a>
      <button type="button" className={styles.hide} onClick={onHide}>
        <span aria-hidden="true">✕</span>
        <span className="visually-hidden">{t('reports_hide')}</span>
      </button>
    </aside>
  );
}
