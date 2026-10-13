import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { KanaInput } from '../../components/KanaInput.tsx';
import { Ruby } from '../../components/Ruby.tsx';
import type { Word } from '../../data/schema.ts';
import { FORM_LABELS } from '../../i18n/forms.ts';
import { useT } from '../../i18n/hooks.ts';
import { conjugate, type Conjugated, type ConjugationForm } from '../../lib/conjugate.ts';
import { furiganaFor } from '../../lib/furigana.ts';
import { finishKana } from '../../lib/kana.ts';
import { mulberry32 } from '../../lib/random.ts';
import type { QuestionProps } from '../types.ts';
import { buildChoices } from './choices.ts';
import styles from './ConjugationQuestion.module.css';
import { ConjugationRule } from './ConjugationRule.tsx';
import { asForm, checkTyped, promptForm, withReading, written } from './drill.ts';

type Mark = 'correct' | 'wrong';

/**
 * One conjugation question (SPEC §9.4): a verb in ます form (in dictionary form when ます is
 * asked) and a target form → type the form, or pick it among four. The answer carries the rule.
 */
export function ConjugationQuestion({ card, word, options, seed, onAnswer }: QuestionProps) {
  const t = useT();
  const form = asForm(card.form);
  const shown = form === undefined ? undefined : conjugate(word, promptForm(form));
  const expected = form === undefined ? undefined : conjugate(word, form);
  // an eligible card always has both; nothing to ask otherwise
  if (form === undefined || shown === undefined || expected === undefined) return null;

  const answer = (correct: boolean, given: string) =>
    onAnswer({
      correct,
      hinted: false,
      given,
      expected: withReading(expected),
      expectedLang: 'ja',
      explanation: <ConjugationRule word={word} form={form} />,
    });

  const typing = options.inputMode === 'typing';
  return (
    <div className={styles.question}>
      <div className={styles.prompt} data-conj-prompt data-word-id={word.id} data-form={form}>
        <Ruby
          pairs={furiganaFor(shown)}
          readings={options.furigana}
          className={`${styles.promptJa} ${options.furigana ? styles.withRuby : ''}`}
        />
        <span className={styles.target}>
          <span aria-hidden="true">→ </span>
          <span lang="ja" data-target>
            {FORM_LABELS[form]}
          </span>
        </span>
      </div>
      <p className={styles.ask}>{t(typing ? 'conj_ask_typing' : 'conj_ask_choices')}</p>
      {typing ? (
        <TypedAnswer expected={expected} onDone={answer} />
      ) : (
        <ChoiceAnswer
          word={word}
          form={form}
          furigana={options.furigana}
          seed={seed}
          onDone={answer}
        />
      )}
    </div>
  );
}

/** The form typed in romaji or kana; Enter or Check submits (SPEC §9.3 conversion). */
function TypedAnswer({
  expected,
  onDone,
}: {
  expected: Conjugated;
  onDone(correct: boolean, given: string): void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const [mark, setMark] = useState<Mark>();
  const answered = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (answered.current) return;
    const given = finishKana(value, expected.kana);
    // nothing typed yet: nothing to judge
    if (given === '') return;
    answered.current = true;
    const correct = checkTyped(given, expected);
    setValue(given);
    setMark(correct ? 'correct' : 'wrong');
    onDone(correct, given);
  };

  return (
    <form className={styles.answer} onSubmit={submit}>
      <div className={styles.field}>
        <KanaInput
          inputRef={inputRef}
          expected={expected.kana}
          value={value}
          onValue={setValue}
          locked={mark !== undefined}
          className={styles.input}
          aria-label={t('kana_answer_label')}
          placeholder={t('kana_placeholder')}
          enterKeyHint="go"
          data-state={mark}
          autoFocus
        />
        {mark !== undefined && (
          <span className={styles.mark} data-mark={mark} aria-hidden="true">
            {mark === 'correct' ? '◯' : '✕'}
          </span>
        )}
      </div>
      <button type="submit" className={styles.check} disabled={mark !== undefined}>
        {t('kana_check')}
      </button>
    </form>
  );
}

/** Four options (SPEC §9.4): taps, or keys 1–4. */
function ChoiceAnswer({
  word,
  form,
  furigana,
  seed,
  onDone,
}: {
  word: Word;
  form: ConjugationForm;
  furigana: boolean;
  seed: number;
  onDone(correct: boolean, given: string): void;
}) {
  const choices = useMemo(
    () => buildChoices({ word, form, rng: mulberry32(seed) }),
    [word, form, seed],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const answered = useRef(false);
  const options = choices?.options ?? [];
  const kanaOnly = choices?.kanaOnly ?? false;
  const text = (c: Conjugated) => (kanaOnly ? c.kana : written(c));

  const choose = (index: number) => {
    const option = options[index];
    if (answered.current || option === undefined) return;
    answered.current = true;
    setPicked(index);
    onDone(option.correct, text(option.form));
  };

  useEffect(() => {
    if (picked !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      e.preventDefault();
      choose(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <ol className={styles.choices}>
      {options.map((option, i) => {
        const state =
          picked === null
            ? undefined
            : option.correct
              ? 'correct'
              : picked === i
                ? 'wrong'
                : 'other';
        return (
          <li key={option.form.kana}>
            <button
              type="button"
              className={styles.choice}
              data-choice
              data-option={text(option.form)}
              data-state={state}
              disabled={picked !== null}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => choose(i)}
            >
              <span className={styles.key} aria-hidden="true">
                {i + 1}
              </span>
              {kanaOnly ? (
                <span lang="ja" className={`${styles.label} ${styles.labelJa}`}>
                  {option.form.kana}
                </span>
              ) : (
                <Ruby
                  pairs={furiganaFor(option.form)}
                  readings={furigana}
                  className={`${styles.label} ${styles.labelJa} ${furigana ? styles.withRuby : ''}`}
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
  );
}
