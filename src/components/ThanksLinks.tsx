import { AUTHOR_HANDLE, AUTHOR_URL, COFFEE_URL, SENSEI_HANDLE, SENSEI_URL } from '../app/links.ts';
import { useT } from '../i18n/hooks.ts';
import styles from './ThanksLinks.module.css';

/**
 * Saying thanks (SPEC §7.1, §7.7): my sensei and me on Instagram, and my coffee page, one ruled
 * row each. Plain links in a new tab, never those sites' widgets, whose scripts would be requests
 * to other sites. Each drawing is in ink, like the ⚑: emoji would come in the system's colors.
 */
export function ThanksLinks() {
  const t = useT();
  const links = [
    {
      href: SENSEI_URL,
      name: t('thanks_sensei'),
      where: `${SENSEI_HANDLE} · Instagram`,
      icon: (
        // a square seal, like a hanko
        <svg
          viewBox="0 0 24 24"
          className={`${styles.icon} ${styles.seal}`}
          aria-hidden="true"
          focusable="false"
        >
          <rect x="2.5" y="2.5" width="19" height="19" rx="3" />
          <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" lang="ja">
            先
          </text>
        </svg>
      ),
    },
    {
      href: AUTHOR_URL,
      name: t('thanks_author', { handle: AUTHOR_HANDLE }),
      where: 'Instagram',
      icon: (
        // a pen
        <svg
          viewBox="0 0 24 24"
          className={`${styles.icon} ${styles.pen}`}
          aria-hidden="true"
          focusable="false"
        >
          <path d="M15.5 4.5l4 4L9 19l-5 1 1-5z" />
          <path d="M13 7l4 4" />
        </svg>
      ),
    },
    {
      href: COFFEE_URL,
      name: t('about_coffee'),
      where: COFFEE_URL.replace('https://', ''),
      icon: (
        // a cup
        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
          <path d="M8 3.5c-1 1 1 2 0 3.5M12 3.5c-1 1 1 2 0 3.5" />
          <path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
          <path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16M3 21.5h16" />
        </svg>
      ),
    },
  ];
  return (
    <ul className={styles.links}>
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {link.icon}
            <span className={styles.text}>
              <span className={styles.name}>{link.name}</span>
              <span className={styles.where}>{link.where}</span>
            </span>
            {/* ↗: it opens in a new tab */}
            <svg viewBox="0 0 24 24" className={styles.out} aria-hidden="true" focusable="false">
              <path d="M8 16L16 8M9.5 8H16v6.5" />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
