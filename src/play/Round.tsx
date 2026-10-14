import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react';
import type { Word } from '../data/schema.ts';
import type { AnswerResult, Minigame } from '../games/types.ts';
import { useT } from '../i18n/hooks.ts';
import { newId } from '../lib/random.ts';
import { deviceId } from '../progress/device.ts';
import { answerEvent, roundEvent } from '../progress/events.ts';
import { progress } from '../progress/store.ts';
import { ReportLink } from '../reports/ReportLink.tsx';
import type { RoundPlan } from './plan.ts';
import { isLastQuestion, roundReducer, startRound, type AnswerRecord } from './round.ts';
import { addAnswer, formatMultiplier, type Tally } from './score.ts';
import styles from './Round.module.css';
import { Stamp } from './Stamp.tsx';

/** A correct answer moves on by itself after this long (SPEC §8.3). */
const ADVANCE_MS = 800;
/** …or after this long when it comes with a rule, so the rule can be read. */
const RULE_ADVANCE_MS = 2500;

/** A field a typed answer went into (kana typing), as opposed to buttons and other controls. */
const isTextField = (el: Element | null): boolean =>
  el instanceof HTMLInputElement && el.type === 'text';

/** Logging never blocks play: the store counts the answer at once and saves it in the background. */
const log = progress.record;

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

  // correct: move on after a moment (longer with a rule, or with something revealed to read);
  // wrong: wait for Continue
  const advanceLater = useEffectEvent(advance);
  const correctShown = feedback?.result.correct === true;
  const ruleShown = feedback?.result.explanation !== undefined;
  const lingers = ruleShown || feedback?.result.reveals === true;
  useEffect(() => {
    if (!correctShown) return;
    const timer = window.setTimeout(advanceLater, lingers ? RULE_ADVANCE_MS : ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [correctShown, lingers, state.index]);

  // Continue after a wrong answer, and after a correct one that lingers, to move on sooner. A right
  // answer typed into a field leaves the focus there, so a phone keeps its keyboard up.
  const wrongShown = feedback?.result.correct === false;
  const continueShown = wrongShown || (correctShown && lingers);
  useEffect(() => {
    if (!continueShown) return;
    if (correctShown && isTextField(document.activeElement)) return;
    continueRef.current?.focus();
  }, [continueShown, correctShown, state.index]);

  // Enter or Space continues, unless a control has focus (a focused button handles them itself).
  // In a text field that kept its focus, Enter continues and Space stays a space.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented || (e.key !== 'Enter' && e.key !== ' ')) return;
    const target = e.target instanceof Element ? e.target : null;
    const control = target?.closest('button, a, input, select, textarea') ?? null;
    if (isTextField(target) ? e.key !== 'Enter' : control !== null) return;
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
            <Stamp kind={feedback.result.correct ? 'maru' : 'batsu'} animate />
          </div>
        )}
      </div>

      <div className={styles.feedbackRow}>
        <div className={styles.feedback} role="status">
          {feedback !== undefined && (
            <>
              {feedback.result.correct ? (
                <p className={styles.correct}>{t('feedback_correct')}</p>
              ) : (
                <p className={styles.wrong}>
                  {t('feedback_wrong')} {t('feedback_answer')}{' '}
                  <span className={styles.expected} lang={feedback.result.expectedLang}>
                    {feedback.result.expected}
                  </span>
                </p>
              )}
              {ruleShown && (
                <p className={styles.explanation} data-explanation>
                  {feedback.result.explanation}
                </p>
              )}
            </>
          )}
        </div>
        {/* outside the live region, so it isn't read out with every answer (SPEC §5.7) */}
        {feedback !== undefined && word !== undefined && (
          <ReportLink
            className={styles.report}
            report={{
              word,
              from: t(game.nameKey),
              ...(feedback.card.form !== undefined && { form: feedback.card.form }),
              answer: feedback.result.expected,
            }}
          />
        )}
      </div>

      {continueShown && (
        <button ref={continueRef} type="button" className={styles.continue} onClick={advance}>
          {t('feedback_continue')}
        </button>
      )}
    </section>
  );
}
