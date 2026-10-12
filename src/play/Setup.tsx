import { PLAY_HREF } from '../app/routes.ts';
import { deckId, wordsInDeck, wordsInDecks, type NotebookDeck } from '../data/decks.ts';
import type { Word } from '../data/schema.ts';
import { DIRECTIONS, type Direction, type Minigame } from '../games/types.ts';
import type { MessageKey } from '../i18n/en.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { deckName, deckNameJa } from '../i18n/names.ts';
import { bestKey } from '../progress/bests.ts';
import { useBest } from '../progress/useBest.ts';
import { eligibleWords } from './plan.ts';
import { ROUND_SIZES } from './queue.ts';
import { unavailableReason, type SetupChoice } from './setup.ts';
import styles from './Setup.module.css';

const DIRECTION_KEYS: Record<Direction, MessageKey> = {
  forward: 'direction_forward',
  reverse: 'direction_reverse',
  mixed: 'direction_mixed',
};

/** Game setup (SPEC §7.3): decks, round size and the game's options, plus the personal best. */
export function Setup({
  game,
  decks,
  allWords,
  now,
  choice,
  onChange,
  onStart,
}: {
  game: Minigame;
  decks: readonly NotebookDeck[];
  allWords: readonly Word[];
  now: Date;
  choice: SetupChoice;
  onChange(next: SetupChoice): void;
  onStart(): void;
}) {
  const t = useT();
  const { lang } = useLang();
  const selected = decks.filter((d) => choice.deckIds.includes(deckId(d)));
  // counts are of the words this game can ask about, not every word in the decks
  const playable = (words: readonly Word[]) => eligibleWords(game, choice.options, words);
  const pool = playable(wordsInDecks(selected, allWords, now));
  const reason = unavailableReason(game, allWords, lang);
  const best = useBest(
    game.id,
    bestKey(game.id, choice.deckIds, choice.size, game.variant(choice.options)),
  );

  const blocker =
    reason !== undefined
      ? t(reason.key, 'n' in reason ? { n: reason.n } : undefined)
      : choice.deckIds.length === 0
        ? t('setup_decks_none')
        : pool.length === 0
          ? t('setup_pool_empty')
          : undefined;

  const toggleDeck = (id: string, on: boolean) => {
    const deckIds = on
      ? [...choice.deckIds, id]
      : choice.deckIds.filter((selectedId) => selectedId !== id);
    onChange({ ...choice, deckIds });
  };

  return (
    <section className={styles.setup} aria-labelledby="setup-title">
      <a href={PLAY_HREF} className={styles.back}>
        ← {t('setup_back')}
      </a>
      <h1 id="setup-title" className={styles.title}>
        {t(game.nameKey)}{' '}
        <span lang="ja" className={styles.titleJa}>
          {game.nameJa}
        </span>
      </h1>

      <div className={styles.sheet}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('setup_decks')}</legend>
          <div className={styles.decks}>
            {decks.map((deck) => {
              const id = deckId(deck);
              const ja = deckNameJa(deck);
              return (
                <label key={id} className={styles.deck}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={choice.deckIds.includes(id)}
                    onChange={(e) => toggleDeck(id, e.target.checked)}
                  />
                  <span className={styles.deckName}>{deckName(deck, lang, t)}</span>
                  {ja !== undefined && (
                    <span className={styles.deckJa} lang="ja">
                      {ja}
                    </span>
                  )}
                  <span className={styles.deckCount}>
                    {playable(wordsInDeck(deck, allWords, now)).length}
                  </span>
                </label>
              );
            })}
          </div>
          <p className={styles.note}>
            {t(pool.length === 1 ? 'setup_pool_one' : 'setup_pool_other', { n: pool.length })}
          </p>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('setup_size')}</legend>
          <div className={styles.pills}>
            {ROUND_SIZES.map((size) => (
              <label key={size} className={styles.pill}>
                <input
                  type="radio"
                  name={`${game.id}-size`}
                  className={styles.radio}
                  checked={choice.size === size}
                  onChange={() => onChange({ ...choice, size })}
                />
                {t('setup_size_option', { n: size })}
              </label>
            ))}
          </div>
        </fieldset>

        {game.options.includes('direction') && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('setup_direction')}</legend>
            <div className={styles.pills}>
              {DIRECTIONS.map((direction) => (
                <label key={direction} className={styles.pill}>
                  <input
                    type="radio"
                    name={`${game.id}-direction`}
                    className={styles.radio}
                    checked={choice.options.direction === direction}
                    onChange={() =>
                      onChange({ ...choice, options: { ...choice.options, direction } })
                    }
                  />
                  {t(DIRECTION_KEYS[direction])}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {game.options.includes('furigana') && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('setup_furigana')}</legend>
            <div className={styles.pills}>
              {[true, false].map((furigana) => (
                <label key={String(furigana)} className={styles.pill}>
                  <input
                    type="radio"
                    name={`${game.id}-furigana`}
                    className={styles.radio}
                    checked={choice.options.furigana === furigana}
                    onChange={() =>
                      onChange({ ...choice, options: { ...choice.options, furigana } })
                    }
                  />
                  {t(furigana ? 'setup_on' : 'setup_off')}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.best} data-best>
          {best.status === 'ready' &&
            (best.best === undefined
              ? t('setup_no_best')
              : t('setup_best', { n: best.best.toLocaleString(lang) }))}
        </p>
        {blocker !== undefined && <p className={styles.blocker}>{blocker}</p>}
        <button
          type="button"
          className={styles.start}
          disabled={blocker !== undefined}
          onClick={onStart}
        >
          {t('setup_start')}
        </button>
      </div>
    </section>
  );
}
