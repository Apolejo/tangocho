import { useEffect, useRef } from 'react';
import { notebookHref } from '../app/routes.ts';
import { deckId, type NotebookDeck } from '../data/decks.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { deckName, deckNameJa } from '../i18n/names.ts';
import styles from './DeckTabs.module.css';

/** Decks as notebook index tabs (SPEC §7.2). The selected tab is the one in the hash. */
export function DeckTabs({ decks, selectedId }: { decks: NotebookDeck[]; selectedId: string }) {
  const { lang } = useLang();
  const t = useT();
  const selectedRef = useRef<HTMLAnchorElement>(null);

  // keep the selected tab visible when the strip overflows (phones)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  return (
    <nav className={styles.tabs} aria-label={t('decks_label')}>
      <ul className={styles.list}>
        {decks.map((deck) => {
          const id = deckId(deck);
          const ja = deckNameJa(deck);
          return (
            <li key={id}>
              <a
                ref={id === selectedId ? selectedRef : undefined}
                href={notebookHref(id)}
                className={styles.tab}
                aria-current={id === selectedId ? 'page' : undefined}
              >
                <span className={styles.name}>{deckName(deck, lang, t)}</span>
                {ja !== undefined && (
                  <span className={styles.ja} lang="ja">
                    {ja}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
