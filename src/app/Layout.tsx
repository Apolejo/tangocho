import { useState } from 'react';
import { LangToggle } from '../components/LangToggle.tsx';
import { useT } from '../i18n/hooks.ts';
import { ReportsBanner } from '../reports/ReportsBanner.tsx';
import styles from './Layout.module.css';
import { PLAY_HREF } from './routes.ts';

export type Section = 'notebook' | 'play' | undefined;

export function Layout({
  section,
  reports,
  children,
}: {
  section: Section;
  /** Show the open word reports (SPEC §5.7): on the notebook and the game list, never mid-round. */
  reports: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const [reportsHidden, setReportsHidden] = useState(false);
  return (
    <>
      <header className={styles.header}>
        <a href="#/notebook" className={styles.brand}>
          <span className={styles.brandJa} lang="ja">
            単語帳
          </span>
          <span className={styles.brandName}>{t('appName')}</span>
        </a>
        <nav className={styles.nav} aria-label={t('nav_label')}>
          <a
            href="#/notebook"
            className={styles.navLink}
            aria-current={section === 'notebook' ? 'page' : undefined}
          >
            {t('nav_notebook')}
          </a>
          <a
            href={PLAY_HREF}
            className={styles.navLink}
            aria-current={section === 'play' ? 'page' : undefined}
          >
            {t('nav_play')}
          </a>
        </nav>
        <div className={styles.lang}>
          <LangToggle />
        </div>
      </header>
      {reports && !reportsHidden && <ReportsBanner onHide={() => setReportsHidden(true)} />}
      <main className={styles.main}>{children}</main>
    </>
  );
}
