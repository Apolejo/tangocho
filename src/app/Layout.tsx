import { LangToggle } from '../components/LangToggle.tsx';
import { useT } from '../i18n/hooks.ts';
import type { MessageKey } from '../i18n/en.ts';
import { UpdateBanner } from '../components/UpdateBanner.tsx';
import styles from './Layout.module.css';
import { PLAY_HREF, SETTINGS_HREF, STATS_HREF, TODAY_HREF } from './routes.ts';

export type Section = 'today' | 'notebook' | 'play' | 'stats' | 'settings' | undefined;

const NAV: readonly { section: Section; href: string; key: MessageKey }[] = [
  { section: 'today', href: TODAY_HREF, key: 'nav_today' },
  { section: 'notebook', href: '#/notebook', key: 'nav_notebook' },
  { section: 'play', href: PLAY_HREF, key: 'nav_play' },
  { section: 'stats', href: STATS_HREF, key: 'nav_stats' },
];

export function Layout({
  section,
  banners,
  children,
}: {
  section: Section;
  /** Show a new version (SPEC §4): on Today, the notebook and the game list, never mid-round. */
  banners: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <>
      <header className={styles.header}>
        <a href={TODAY_HREF} className={styles.brand}>
          <span className={styles.brandJa} lang="ja">
            単語帳
          </span>
          <span className={styles.brandName}>{t('appName')}</span>
        </a>
        <nav className={styles.nav} aria-label={t('nav_label')}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={styles.navLink}
              aria-current={section === item.section ? 'page' : undefined}
            >
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className={styles.tools}>
          <LangToggle />
          <a
            href={SETTINGS_HREF}
            className={styles.settings}
            aria-label={t('nav_settings')}
            title={t('nav_settings')}
            aria-current={section === 'settings' ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="6.5" />
              <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
            </svg>
          </a>
        </div>
      </header>
      {banners && <UpdateBanner />}
      <main className={styles.main}>{children}</main>
    </>
  );
}
