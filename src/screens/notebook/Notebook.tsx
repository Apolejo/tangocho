import { DeckTabs } from '../../components/DeckTabs.tsx';
import { WordRow } from '../../components/WordRow.tsx';
import { deckId, notebookDecks, wordsInDeck } from '../../data/decks.ts';
import { decks, words } from '../../data/load.ts';
import { useT } from '../../i18n/hooks.ts';
import styles from './Notebook.module.css';

const DECKS = notebookDecks(decks);
/** "New this week" is relative to when the app was opened. */
const OPENED_AT = new Date();

/** SPEC §7.2: deck tabs → word list with furigana, meanings, verb group and note. */
export function Notebook({ deckId: selectedId }: { deckId: string }) {
  const t = useT();
  const deck = DECKS.find((d) => deckId(d) === selectedId);
  const list = deck === undefined ? [] : wordsInDeck(deck, words, OPENED_AT);

  return (
    <section className={styles.notebook} aria-labelledby="notebook-title">
      <h1 id="notebook-title" className={styles.title}>
        {t('nav_notebook')}
      </h1>
      <DeckTabs decks={DECKS} selectedId={selectedId} />
      <div className={styles.page}>
        {deck === undefined ? (
          <p className={styles.empty}>{t('notebook_unknown_deck')}</p>
        ) : list.length === 0 ? (
          <p className={styles.empty}>{t('notebook_empty')}</p>
        ) : (
          <>
            <p className={styles.count}>
              {t(list.length === 1 ? 'notebook_count_one' : 'notebook_count_other', {
                n: list.length,
              })}
            </p>
            <ol className={styles.list}>
              {list.map((word) => (
                <WordRow key={word.id} word={word} />
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
