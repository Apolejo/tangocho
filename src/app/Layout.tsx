import { LangToggle } from '../components/LangToggle.tsx';
import { useT } from '../i18n/hooks.ts';
import styles from './Layout.module.css';

export function Layout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <>
      <header className={styles.header}>
        <a href="#/notebook" className={styles.brand}>
          <span className={styles.brandJa} lang="ja">
            単語帳
          </span>
          <span className={styles.brandName}>{t('appName')}</span>
        </a>
        <LangToggle />
      </header>
      <main className={styles.main}>{children}</main>
    </>
  );
}
