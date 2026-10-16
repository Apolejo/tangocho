import { useId } from 'react';
import { Sheet } from '../../components/Sheet.tsx';
import sheet from '../../components/Sheet.module.css';
import { ThanksLinks } from '../../components/ThanksLinks.tsx';
import { useT } from '../../i18n/hooks.ts';
import styles from './ThanksSheet.module.css';

/** Today's Thanks (SPEC §7.1): the thanks links, in a sheet only a tap opens. */
export function ThanksSheet({ onClose }: { onClose(): void }) {
  const t = useT();
  const titleId = useId();
  return (
    <Sheet
      titleId={titleId}
      onClose={onClose}
      header={
        <h2 id={titleId} className={`${sheet.title} ${styles.title}`}>
          {t('thanks')}{' '}
          <span lang="ja" className={styles.titleJa}>
            ありがとう
          </span>
        </h2>
      }
    >
      <p className={styles.note}>{t('about_thanks')}</p>
      <ThanksLinks />
    </Sheet>
  );
}
