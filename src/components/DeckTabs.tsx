import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { notebookHref } from '../app/routes.ts';
import { deckId, type NotebookDeck } from '../data/decks.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { deckName, deckNameJa } from '../i18n/names.ts';
import buttons from './Buttons.module.css';
import styles from './DeckTabs.module.css';

/** Keys that move between the tabs, as in a tab list: from the index of the focused tab to the next. */
const STEPS: Partial<Record<string, (index: number, count: number) => number>> = {
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowRight: (i, n) => (i + 1) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/**
 * Decks as notebook index tabs (SPEC §7.2). The selected tab is the one in the hash. The row is one
 * Tab stop: the arrow keys, Home and End open the other decks. When the row doesn't fit, ‹ and ›
 * at its ends scroll it on a computer; a phone swipes it.
 */
export function DeckTabs({ decks, selectedId }: { decks: NotebookDeck[]; selectedId: string }) {
  const { lang } = useLang();
  const t = useT();
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLAnchorElement>(null);
  const [hidden, setHidden] = useState({ start: false, end: false });
  // an unknown deck selects no tab, and the first one keeps the row reachable by Tab
  const tabStop = Math.max(
    0,
    decks.findIndex((deck) => deckId(deck) === selectedId),
  );

  // keep the selected tab visible when the strip overflows
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  // which ends of the strip are scrolled out of sight; the tabs resize with the language and fonts
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const measure = () => {
      const start = list.scrollLeft > 1;
      const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      setHidden((was) => (was.start === start && was.end === end ? was : { start, end }));
    };
    const resized = new ResizeObserver(measure);
    resized.observe(list);
    for (const item of list.children) resized.observe(item);
    list.addEventListener('scroll', measure, { passive: true });
    return () => {
      resized.disconnect();
      list.removeEventListener('scroll', measure);
    };
  }, [decks]);

  const scroll = (direction: -1 | 1) => {
    const list = listRef.current;
    if (list !== null) list.scrollBy({ left: direction * list.clientWidth * 0.75 });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = STEPS[event.key];
    if (step === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const tabs = [...event.currentTarget.querySelectorAll('a')];
    const from = tabs.findIndex((tab) => tab === document.activeElement);
    const to = tabs[step(from, tabs.length)];
    if (from === -1 || to === undefined) return;
    event.preventDefault();
    to.focus();
    // switching decks this way leaves no trail of history entries behind
    window.location.replace(to.href);
  };

  // ‹ › are for the mouse: the keyboard has the arrows, so they never take the focus
  const scrollButton = (direction: -1 | 1) => (
    <button
      type="button"
      className={`${buttons.small} ${styles.scroll}`}
      data-scroll={direction === -1 ? 'start' : 'end'}
      tabIndex={-1}
      aria-hidden="true"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => scroll(direction)}
    >
      {direction === -1 ? '‹' : '›'}
    </button>
  );

  return (
    <nav className={styles.tabs} aria-label={t('decks_label')}>
      <ul
        ref={listRef}
        className={styles.list}
        data-hidden-start={hidden.start || undefined}
        data-hidden-end={hidden.end || undefined}
        onKeyDown={onKeyDown}
      >
        {decks.map((deck, index) => {
          const id = deckId(deck);
          const ja = deckNameJa(deck);
          return (
            <li key={id}>
              <a
                ref={id === selectedId ? selectedRef : undefined}
                href={notebookHref(id)}
                className={styles.tab}
                aria-current={id === selectedId ? 'page' : undefined}
                tabIndex={index === tabStop ? 0 : -1}
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
      {hidden.start && scrollButton(-1)}
      {hidden.end && scrollButton(1)}
    </nav>
  );
}
