import { useEffect, useRef } from 'react';
import { useT } from '../i18n/hooks.ts';
import styles from './Sheet.module.css';

/**
 * A bottom sheet on a phone, a dialog on the computer (SPEC §7.1, §7.2). A native modal
 * <dialog>, so focus moves in, Esc closes it and the page behind is inert; closed, it gives the
 * focus back to what opened it. ✕ or a tap outside closes it too. Shown when mounted.
 */
export function Sheet({
  titleId,
  header,
  onClose,
  children,
}: {
  /** The id of the heading in `header`, which names the dialog. */
  titleId: string;
  /** The heading, and anything beside it, before the ✕. Give the heading `title` from Sheet.module.css. */
  header: React.ReactNode;
  onClose(): void;
  children: React.ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  // removed from the page, an open dialog closes by itself; StrictMode runs this twice
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const close = () => ref.current?.close();
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      // the dialog itself is only hit outside its content: the backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          {header}
          <button type="button" className={styles.close} onClick={close}>
            <span aria-hidden="true">✕</span>
            <span className="visually-hidden">{t('sheet_close')}</span>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
