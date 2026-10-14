import { useEffect, useRef, useState } from 'react';
import { focusScreenHeading } from '../app/focus.ts';
import { reloadToUpdate, usePwa } from '../app/pwa.ts';
import { useT } from '../i18n/hooks.ts';
import styles from './UpdateBanner.module.css';

/** ✕ hides it until the next launch, across screens. */
let hiddenThisLaunch = false;

/**
 * "A new version is ready · Reload" (SPEC §4, §7.1), where the word-reports banner goes: on
 * Today, the notebook and the game list, never during a round.
 */
export function UpdateBanner() {
  const t = useT();
  const { needRefresh } = usePwa();
  const [hidden, setHidden] = useState(hiddenThisLaunch);
  // ✕ takes the banner away with the focus on it: the screen's heading gets it back
  const shown = useRef(hidden);
  useEffect(() => {
    if (shown.current === hidden) return;
    shown.current = hidden;
    focusScreenHeading();
  }, [hidden]);

  if (!needRefresh || hidden) return null;
  const hide = () => {
    hiddenThisLaunch = true;
    setHidden(true);
  };
  return (
    <aside className={styles.banner} aria-label={t('update_label')} data-update-banner>
      <p className={styles.text}>{t('update_ready')}</p>
      <button type="button" className={styles.reload} onClick={reloadToUpdate}>
        {t('update_reload')}
      </button>
      <button type="button" className={styles.hide} onClick={hide}>
        <span aria-hidden="true">✕</span>
        <span className="visually-hidden">{t('update_hide')}</span>
      </button>
    </aside>
  );
}
