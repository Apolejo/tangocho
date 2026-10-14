import { useEffect, useRef, useState } from 'react';
import { focusScreenHeading } from '../../app/focus.ts';
import { SETTINGS_HREF } from '../../app/routes.ts';
import { useT } from '../../i18n/hooks.ts';
import styles from './ExportBanner.module.css';

/** ✕ hides the reminder until the next launch, across screens. */
let hiddenThisLaunch = false;

/**
 * The export reminder on Today (SPEC §7.1, §10.1): no export in 7 days (or none yet, a week
 * after the first answer). Links to Settings, where the export is.
 */
export function ExportBanner({ never }: { never: boolean }) {
  const t = useT();
  const [hidden, setHidden] = useState(hiddenThisLaunch);
  // ✕ takes the banner away with the focus on it: the screen's heading gets it back
  const shown = useRef(hidden);
  useEffect(() => {
    if (shown.current === hidden) return;
    shown.current = hidden;
    focusScreenHeading();
  }, [hidden]);
  if (hidden) return null;
  const hide = () => {
    hiddenThisLaunch = true;
    setHidden(true);
  };
  return (
    <aside className={styles.banner} aria-label={t('export_banner_label')} data-export-banner>
      <div className={styles.body}>
        <p className={styles.text}>{t(never ? 'export_banner_never' : 'export_banner_week')}</p>
        <a href={SETTINGS_HREF} className={styles.link}>
          {t('export_banner_link')}
        </a>
      </div>
      <button type="button" className={styles.hide} onClick={hide}>
        <span aria-hidden="true">✕</span>
        <span className="visually-hidden">{t('export_banner_hide')}</span>
      </button>
    </aside>
  );
}
