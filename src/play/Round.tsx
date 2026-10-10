import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react';
import type { Word } from '../data/schema.ts';
import type { AnswerResult, Minigame } from '../games/types.ts';
import { useT } from '../i18n/hooks.ts';
import { newId } from '../lib/random.ts';
import { appendEvent } from '../progress/db.ts';
import { deviceId } from '../progress/device.ts';
import { answerEvent, roundEvent, type ProgressEvent } from '../progress/events.ts';
import type { RoundPlan } from './plan.ts';
import { isLastQuestion, roundReducer, startRound, type AnswerRecord } from './round.ts';
import { addAnswer, formatMultiplier, type Tally } from './score.ts';
import styles from './Round.module.css';
import { Stamp } from './Stamp.tsx';

/** A correct answer moves on by itself after this long (SPEC §8.3). */
const ADVANCE_MS = 800;

/** Logging never blocks play: a failed write is reported and the round goes on. */
function log(event: ProgressEvent): void {
  appendEvent(event).catch((error: unknown) => console.warn('could not save progress', error));
}

/**
 * The play screen (SPEC §7.4): progress, score and combo, the game's question, ◯/✕ feedback.
 * Times each answer and appends its event; the last answer also appends the round's event.
 */
export function Round({
  game,
  plan,
  allWords,
  onDone,
  onQuit,
}: {
  game: Minigame;
  plan: RoundPlan;
  allWords: readonly Word[];
  onDone(answers: readonly AnswerRecord[], tally: Tally): void;
  onQuit(): void;
}) {
  const t = useT();
  const [state, dispatch] = useReducer(roundReducer, plan.queue, startRound);
  const wordsById = useMemo(() => new Map(allWords.map((w) => [w.id, w])), [allWords]);
  const shownAt = useRef(0);
  const answeredIndex = useRef(-1);
  const continueRef = useRef<HTMLButtonElement>(null);

  const current = state.queue[state.index];
  const word = current === undefined ? undefined : wordsById.get(current.card.wordId);
  const last = state.answers.at(-1);
  const feedback = state.phase === 'feedback' ? last : undefined;
  const total = state.queue.length;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [state.index]);

  const onAnswer = (result: AnswerResult) => {
    if (current === undefined || answeredIndex.current === state.index) return;
    answeredIndex.current = state.index;
    const ms = Math.round(performance.now() - shownAt.current);
    dispatch({ type: 'answer', result, ms });
    const at = new Date();
    const { wordId, skill, form } = current.card;
    log(
      answerEvent(
        {
          roundId: plan.id,
          game: game.id,
          wordId,
          skill,
          ...(form !== undefined && { form }),
          correct: result.correct,
          hinted: result.hinted,
          ms,
          device: deviceId(),
        },
        newId(),
        at,
      ),
    );
    if (isLastQuestion(state)) {
      const tally = addAnswer(state.tally, result);
      log(
        roundEvent(
          {
            id: plan.id,
            game: game.id,
            deckIds: [...plan.deckIds],
            size: plan.size,
            variant: game.variant(plan.options),
            practice: plan.practice,
            score: tally.score,
            correct: tally.correct,
            total: tally.answered,
          },
          at,
        ),
      );
    }
  };

  const advance = () => {
    if (state.phase !== 'feedback') return;
    if (isLastQuestion(state)) onDone(state.answers, state.tally);
    else dispatch({ type: 'next' });
  };

  // correct: move on after a moment; wrong: wait for Continue
  const advanceLater = useEffectEvent(advance);
  const correctShown = feedback?.result.correct === true;
  useEffect(() => {
    if (!correctShown) return;
    const timer = window.setTimeout(advanceLater, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [correctShown, state.index]);

  const wrongShown = feedback?.result.correct === false;
  useEffect(() => {
    if (wrongShown) continueRef.current?.focus();
  }, [wrongShown, state.index]);

  // Enter or Space continues, unless a control has focus (a focused button handles them itself)
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) {
      return;
    }
    e.preventDefault();
    advance();
  });
  const inFeedback = state.phase === 'feedback';
  useEffect(() => {
    if (!inFeedback) return;
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inFeedback]);

  const n = Math.min(state.index + 1, total);
  const done = state.answers.length;
  return (
    <section className={styles.round} aria-label={t(game.nameKey)}>
      <header className={styles.bar}>
        <button type="button" className={styles.quit} onClick={onQuit}>
          {t('play_quit')}
        </button>
        <div className={styles.progress}>
          <p className={styles.count} data-progress>
            <span aria-hidden="true">
              {n} / {total}
            </span>
            <span className="visually-hidden">{t('play_progress_label', { n, total })}</span>
          </p>
          <div className={styles.track} aria-hidden="true">
            <div
              className={styles.fill}
              style={{ inlineSize: `${total === 0 ? 0 : (done / total) * 100}%` }}
            />
          </div>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>{t('play_score')}</dt>
            <dd data-score>{state.tally.score}</dd>
          </div>
          <div>
            <dt>{t('play_combo')}</dt>
            <dd>{formatMultiplier(state.tally.streak)}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.sheet}>
        {current !== undefined && word !== undefined && (
          <game.Question
            key={state.index}
            card={current.card}
            word={word}
            pool={plan.pool}
            allWords={allWords}
            options={plan.options}
            seed={current.seed}
            onAnswer={onAnswer}
          />
        )}
        {feedback !== undefined && (
          <div className={styles.stamp}>
            <Stamp kind={feedback.result.correct ? 'maru' : 'batsu'} />
          </div>
        )}
      </div>

      <div className={styles.feedback} role="status">
        {feedback !== undefined &&
          (feedback.result.correct ? (
            <p className={styles.correct}>{t('feedback_correct')}</p>
          ) : (
            <>
              <p className={styles.wrong}>
                {t('feedback_wrong')} {t('feedback_answer')}{' '}
                <span className={styles.expected} lang={feedback.result.expectedLang}>
                  {feedback.result.expected}
                </span>
              </p>
              {feedback.result.explanation !== undefined && (
                <p className={styles.explanation}>{feedback.result.explanation}</p>
              )}
            </>
          ))}
      </div>

      {wrongShown && (
        <button ref={continueRef} type="button" className={styles.continue} onClick={advance}>
          {t('feedback_continue')}
        </button>
      )}
    </section>
  );
}
