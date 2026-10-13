import { useMemo } from 'react';
import { WordRow } from '../components/WordRow.tsx';
import type { Word } from '../data/schema.ts';
import type { Card, Minigame } from '../games/types.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { bestKey, isNewRecord } from '../progress/bests.ts';
import { useBest } from '../progress/useBest.ts';
import type { RoundPlan } from './plan.ts';
import styles from './Results.module.css';
import { missedCards, missedWordIds, type AnswerRecord } from './round.ts';
import { accuracy, isPerfect, type Tally } from './score.ts';
import { Stamp } from './Stamp.tsx';

/**
 * Results (SPEC §7.5): score and accuracy, 新記録 for a personal best, 花丸 for a perfect round,
 * and the missed words with *Practice these*.
 */
export function Results({
  game,
  plan,
  answers,
  tally,
  allWords,
  onPractice,
  onAgain,
  onSetup,
}: {
  game: Minigame;
  plan: RoundPlan;
  answers: readonly AnswerRecord[];
  tally: Tally;
  allWords: readonly Word[];
  /** Replays the missed cards, each with its skill and form. */
  onPractice(cards: readonly Card[]): void;
  onAgain(): void;
  onSetup(): void;
}) {
  const t = useT();
  const { lang } = useLang();
  // the best before this round: the round's own event is left out
  const best = useBest(
    game.id,
    bestKey(game.id, plan.deckIds, plan.size, game.variant(plan.options)),
    plan.id,
  );
  const missed = useMemo(() => {
    const byId = new Map(allWords.map((w) => [w.id, w]));
    return missedWordIds(answers).flatMap((id) => byId.get(id) ?? []);
  }, [answers, allWords]);

  const record = !plan.practice && best.status === 'ready' && isNewRecord(tally.score, best.best);
  const perfect = isPerfect(tally);

  return (
    <section className={styles.results} aria-labelledby="results-title">
      <h1 id="results-title" className={styles.title}>
        {t('results_title')}
      </h1>

      <div className={styles.card}>
        <div className={styles.scoreLine}>
          <div>
            <p className={styles.scoreLabel}>{t('results_score')}</p>
            <p className={styles.score} data-score>
              {tally.score.toLocaleString(lang)}
            </p>
          </div>
          <div className={styles.stamps}>
            {record && <Stamp kind="record" label={t('results_new_record')} />}
            {perfect && <Stamp kind="hanamaru" label={t('results_perfect')} />}
          </div>
        </div>
        <p className={styles.accuracy}>
          {t('results_accuracy', {
            correct: tally.correct,
            total: tally.answered,
            pct: Math.round(accuracy(tally) * 100),
          })}
        </p>
        <p className={styles.best}>
          {plan.practice
            ? t('results_practice_note')
            : best.status === 'ready' &&
              t('results_best', {
                n: Math.max(best.best ?? 0, tally.score).toLocaleString(lang),
              })}
        </p>
      </div>

      <h2 className={styles.subtitle}>{t('results_missed')}</h2>
      <div className={styles.page}>
        {missed.length === 0 ? (
          <p className={styles.empty}>{t('results_none_missed')}</p>
        ) : (
          <ol className={styles.list}>
            {missed.map((word) => (
              <WordRow key={word.id} word={word} from={t(game.nameKey)} />
            ))}
          </ol>
        )}
      </div>

      <div className={styles.actions}>
        {missed.length > 0 && (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onPractice(missedCards(answers))}
          >
            {t('results_practice')}
          </button>
        )}
        <button
          type="button"
          className={missed.length > 0 ? styles.secondary : styles.primary}
          onClick={onAgain}
        >
          {t('results_again')}
        </button>
        <button type="button" className={styles.secondary} onClick={onSetup}>
          {t('results_setup')}
        </button>
      </div>
    </section>
  );
}
