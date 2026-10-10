import { useEffect, useMemo, useRef, useState } from 'react';
import { Ruby } from '../../components/Ruby.tsx';
import type { Word } from '../../data/schema.ts';
import { useLang, useT } from '../../i18n/hooks.ts';
import { furiganaFor } from '../../lib/furigana.ts';
import { mulberry32 } from '../../lib/random.ts';
import { displayForm } from '../../lib/verbs.ts';
import type { QuestionProps } from '../types.ts';
import { buildChoices, meaningText, writtenForm } from './choices.ts';
import styles from './QuizQuestion.module.css';

/**
 * One quick-quiz question (SPEC §9.1): forward shows the Japanese and four meanings; reverse
 * shows a meaning and four Japanese words. Keys 1–4 answer.
 */
export function QuizQuestion({
  card,
  word,
  pool,
  allWords,
  options,
  seed,
  onAnswer,
}: QuestionProps) {
  const { lang } = useLang();
  const t = useT();
  const forward = card.skill === 'meaning';
  const choices = useMemo(
    () =>
      buildChoices({
        target: word,
        skill: card.skill,
        pool,
        allWords,
        lang,
        rng: mulberry32(seed),
      }),
    [word, card.skill, pool, allWords, lang, seed],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const answered = useRef(false);

  const choose = (index: number) => {
    const choice = choices[index];
    if (answered.current || choice === undefined) return;
    answered.current = true;
    setPicked(index);
    const label = (w: Word) => (forward ? meaningText(w, lang).text : writtenForm(w));
    onAnswer({
      correct: choice.correct,
      hinted: false,
      given: label(choice.word),
      expected: label(word),
      expectedLang: forward ? meaningText(word, lang).lang : 'ja',
    });
  };

  useEffect(() => {
    if (picked !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > choices.length) return;
      e.preventDefault();
      choose(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const meaning = meaningText(word, lang);
  return (
    <div className={styles.question}>
      <div className={styles.prompt} data-quiz-prompt data-word-id={word.id}>
        {forward ? (
          <Ruby
            pairs={furiganaFor(displayForm(word))}
            readings={options.furigana}
            className={`${styles.promptJa} ${options.furigana ? styles.withRuby : ''}`}
          />
        ) : (
          <span className={styles.promptMeaning} lang={meaning.lang}>
            {meaning.text}
          </span>
        )}
      </div>
      <p className={styles.ask}>{t(forward ? 'quiz_ask_meaning' : 'quiz_ask_word')}</p>
      <ol className={styles.choices}>
        {choices.map((choice, i) => {
          const state =
            picked === null
              ? undefined
              : choice.correct
                ? 'correct'
                : picked === i
                  ? 'wrong'
                  : 'other';
          const text = meaningText(choice.word, lang);
          return (
            <li key={choice.word.id}>
              <button
                type="button"
                className={styles.choice}
                data-choice
                data-word-id={choice.word.id}
                data-state={state}
                disabled={picked !== null}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => choose(i)}
              >
                <span className={styles.key} aria-hidden="true">
                  {i + 1}
                </span>
                {forward ? (
                  <span className={styles.label} lang={text.lang}>
                    {text.text}
                  </span>
                ) : (
                  <Ruby
                    pairs={furiganaFor(displayForm(choice.word))}
                    readings={options.furigana}
                    className={`${styles.label} ${styles.labelJa} ${options.furigana ? styles.withRuby : ''}`}
                  />
                )}
                {(state === 'correct' || state === 'wrong') && (
                  <span className={styles.mark} data-mark={state} aria-hidden="true">
                    {state === 'correct' ? '◯' : '✕'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
