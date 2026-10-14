import { useState } from 'react';
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
  if (hidden) return null;
  const hide = () => {
    hiddenThisLaunch = true;
    setHidden(true);
  };
  return (
    <aside className={styles.banner} aria-label={t('export_banner_label')} data-export-banner>
      <p className={styles.text}>
        {t(never ? 'export_banner_never' : 'export_banner_week')}{' '}
        <a href={SETTINGS_HREF}>{t('export_banner_link')}</a>
      </p>
      <button type="button" className={styles.hide} onClick={hide}>
        <span aria-hidden="true">✕</span>
        <span className="visually-hidden">{t('export_banner_hide')}</span>
      </button>
    </aside>
  );
}
