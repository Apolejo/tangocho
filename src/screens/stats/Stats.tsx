import { useMemo, useState } from 'react';
import { gameHref } from '../../app/routes.ts';
import buttons from '../../components/Buttons.module.css';
import pills from '../../components/Pills.module.css';
import { Ruby } from '../../components/Ruby.tsx';
import { StampCard } from '../../components/StampCard.tsx';
import { deckId, wordsInDeck } from '../../data/decks.ts';
import { words } from '../../data/load.ts';
import { GAMES } from '../../games/registry.ts';
import type { GameId, Skill } from '../../games/types.ts';
import type { MessageKey } from '../../i18n/en.ts';
import { FORM_LABELS } from '../../i18n/forms.ts';
import { useLang, useT } from '../../i18n/hooks.ts';
import { pickLocalized } from '../../i18n/localized.ts';
import { deckName, deckNameJa } from '../../i18n/names.ts';
import { FORMS } from '../../lib/conjugate.ts';
import { furiganaFor } from '../../lib/furigana.ts';
import { displayForm } from '../../lib/verbs.ts';
import { DECKS, OPENED_AT } from '../../play/catalog.ts';
import { addMonths, dayKey, monthOf } from '../../progress/day.ts';
import { longestStreak, streak } from '../../progress/goal.ts';
import { deckMastery, LEVELS, type MasteryLevel } from '../../progress/mastery.ts';
import {
  accuracyByForm,
  accuracyByGroup,
  VERB_GROUPS,
  weakestCards,
  type Accuracy,
} from '../../progress/stats.ts';
import { useCalendar } from '../../progress/useCalendar.ts';
import { useNow } from '../../progress/useNow.ts';
import { useProgress } from '../../progress/useProgress.ts';
import styles from './Stats.module.css';

const WORDS_BY_ID = new Map(words.map((w) => [w.id, w]));

const LEVEL_KEYS: Record<MasteryLevel, MessageKey> = {
  new: 'mastery_new',
  learning: 'mastery_learning',
  familiar: 'mastery_familiar',
  mastered: 'mastery_mastered',
};

const SKILL_KEYS: Record<Skill, MessageKey> = {
  meaning: 'skill_meaning',
  recall: 'skill_recall',
  reading: 'skill_reading',
  group: 'skill_group',
  conjugation: 'skill_conjugation',
};

const LEVEL_CLASSES: Record<MasteryLevel, string | undefined> = {
  new: styles.new,
  learning: styles.learning,
  familiar: styles.familiar,
  mastered: styles.mastered,
};

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/**
 * Stats (SPEC §7.6, §10.5): mastery per deck, accuracy per verb group and per form, the weakest
 * words per game with *Practice these*, and the streak calendar.
 */
export function Stats() {
  const t = useT();
  const { lang } = useLang();
  const now = useNow();
  const { answers, cards, events } = useProgress();
  const calendar = useCalendar();
  const today = dayKey(now);
  const [weakGame, setWeakGame] = useState<GameId>('quiz');
  const [monthsBack, setMonthsBack] = useState(0);

  const mastery = useMemo(
    () =>
      DECKS.map((deck) => ({
        deck,
        counts: deckMastery(wordsInDeck(deck, words, OPENED_AT), GAMES, cards),
      })).filter(({ counts }) => counts.total > 0),
    [cards],
  );
  const byGroup = useMemo(() => accuracyByGroup(answers, WORDS_BY_ID), [answers]);
  const byForm = useMemo(() => accuracyByForm(answers, WORDS_BY_ID), [answers]);
  const game = GAMES.find((g) => g.id === weakGame) ?? GAMES[0];
  const weak = useMemo(
    () => (game === undefined ? [] : weakestCards(cards, game, WORDS_BY_ID)),
    [cards, game],
  );

  const accuracy = (acc: Accuracy | undefined) =>
    acc === undefined || acc.total === 0
      ? t('stats_no_answers')
      : t('stats_accuracy', {
          pct: percent(acc.correct, acc.total),
          correct: acc.correct,
          total: acc.total,
        });

  const shown = addMonths(monthOf(today), -monthsBack);
  const first = events[0] === undefined ? monthOf(today) : monthOf(dayKey(new Date(events[0].at)));
  const atFirst = shown.year * 12 + shown.month <= first.year * 12 + first.month;

  return (
    <section className={styles.stats} aria-labelledby="stats-title">
      <h1 id="stats-title" className={styles.title}>
        {t('stats_title')}{' '}
        <span lang="ja" className={styles.titleJa}>
          記録
        </span>
      </h1>

      <h2 className={styles.subtitle}>{t('stats_mastery')}</h2>
      <div className={styles.card}>
        <p className={styles.legend}>
          {LEVELS.map((level) => (
            <span key={level} className={styles.key}>
              <span className={`${styles.swatch} ${LEVEL_CLASSES[level]}`} aria-hidden="true" />
              {t(LEVEL_KEYS[level])}
            </span>
          ))}
        </p>
        <ul className={styles.decks}>
          {mastery.map(({ deck, counts }) => {
            const ja = deckNameJa(deck);
            return (
              <li key={deckId(deck)} className={styles.deck} data-deck={deckId(deck)}>
                <p className={styles.deckHead}>
                  <span className={styles.deckName}>
                    {deckName(deck, lang, t)}
                    {ja !== undefined && (
                      <span lang="ja" className={styles.deckJa}>
                        {ja}
                      </span>
                    )}
                  </span>
                  <span className={styles.pct} data-mastered={counts.mastered}>
                    {t('stats_mastered_pct', { pct: percent(counts.mastered, counts.total) })}
                  </span>
                </p>
                <div className={styles.bar} aria-hidden="true">
                  {LEVELS.map((level) =>
                    counts[level] === 0 ? null : (
                      <span
                        key={level}
                        className={`${styles.segment} ${LEVEL_CLASSES[level]}`}
                        style={{ flexGrow: counts[level] }}
                      />
                    ),
                  )}
                </div>
                <p className={styles.counts}>
                  {LEVELS.map((level) => `${t(LEVEL_KEYS[level])} ${counts[level]}`).join(' · ')}
                </p>
              </li>
            );
          })}
        </ul>
        <p className={styles.note}>{t('stats_mastery_note')}</p>
      </div>

      <div className={styles.tables}>
        <div>
          <h2 className={styles.subtitle}>{t('stats_accuracy_group')}</h2>
          <table className={styles.table} data-accuracy-group>
            <thead>
              <tr>
                <th scope="col">{t('stats_col_group')}</th>
                <th scope="col">{t('stats_col_sorter')}</th>
                <th scope="col">{t('stats_col_drill')}</th>
              </tr>
            </thead>
            <tbody>
              {VERB_GROUPS.map((group) => (
                <tr key={group}>
                  <th scope="row">{t('group_badge', { n: group })}</th>
                  <td>{accuracy(byGroup[group].sorter)}</td>
                  <td>{accuracy(byGroup[group].drill)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className={styles.subtitle}>{t('stats_accuracy_form')}</h2>
          <table className={styles.table} data-accuracy-form>
            <thead>
              <tr>
                <th scope="col">{t('stats_col_form')}</th>
                <th scope="col">{t('stats_col_accuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {FORMS.map((form) => (
                <tr key={form}>
                  <th scope="row" lang="ja" className={styles.form}>
                    {FORM_LABELS[form]}
                  </th>
                  <td>{accuracy(byForm.get(form))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className={styles.subtitle}>{t('stats_weakest')}</h2>
      <div className={styles.card}>
        <fieldset className={styles.games}>
          <legend className="visually-hidden">{t('stats_weakest_game')}</legend>
          <div className={pills.pills}>
            {GAMES.map((g) => (
              <label key={g.id} className={pills.pill}>
                <input
                  type="radio"
                  className={pills.radio}
                  name="weakest-game"
                  checked={weakGame === g.id}
                  onChange={() => setWeakGame(g.id)}
                />
                {t(g.nameKey)}
              </label>
            ))}
          </div>
        </fieldset>
        {weak.length === 0 ? (
          <p className={styles.note}>{t('stats_weakest_none')}</p>
        ) : (
          <>
            <ol className={styles.weak} data-weakest={weakGame}>
              {weak.map(({ card, word, misses, answers: n }) => {
                const meaning = pickLocalized(word.meaning, lang);
                return (
                  <li key={`${card.wordId}|${card.skill}`} data-word-id={card.wordId}>
                    <Ruby pairs={furiganaFor(displayForm(word))} className={styles.ja} />
                    <span className={styles.weakText}>
                      {meaning !== undefined && (
                        <span lang={meaning.lang}>{meaning.value.join(', ')}</span>
                      )}
                      <span className={styles.weakMeta}>
                        {t(SKILL_KEYS[card.skill])} · {t('stats_misses', { misses, answers: n })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <a href={gameHref(weakGame, 'weakest')} className={buttons.primary} data-practice>
              {t('results_practice')}
            </a>
          </>
        )}
      </div>

      <h2 className={styles.subtitle}>{t('stats_calendar')}</h2>
      <p className={styles.streaks}>
        <span data-current-streak>
          {t('stats_streak_current', { n: streak(calendar.goalDays, today) })}
        </span>
        <span data-longest-streak>
          {t('stats_streak_longest', { n: longestStreak(calendar.goalDays) })}
        </span>
      </p>
      <StampCard
        year={shown.year}
        month={shown.month}
        today={today}
        goalDays={calendar.goalDays}
        perfectDays={calendar.perfectDays}
        heading={
          <span className={styles.months}>
            <button
              type="button"
              className={buttons.small}
              onClick={() => setMonthsBack((n) => n + 1)}
              disabled={atFirst}
              aria-label={t('stats_month_prev')}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className={buttons.small}
              onClick={() => setMonthsBack((n) => Math.max(0, n - 1))}
              disabled={monthsBack === 0}
              aria-label={t('stats_month_next')}
            >
              <span aria-hidden="true">›</span>
            </button>
          </span>
        }
      />
    </section>
  );
}
