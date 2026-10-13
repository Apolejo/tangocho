import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { JaText } from '../../components/JaText.tsx';
import { KanaInput } from '../../components/KanaInput.tsx';
import { Ruby } from '../../components/Ruby.tsx';
import type { Word } from '../../data/schema.ts';
import { useLang, useT, type Translate } from '../../i18n/hooks.ts';
import { meaningText } from '../../i18n/localized.ts';
import { furiganaFor } from '../../lib/furigana.ts';
import { finishKana } from '../../lib/kana.ts';
import { displayForm } from '../../lib/verbs.ts';
import type { QuestionProps } from '../types.ts';
import { checkKana, expectedKana, hintKana, type KanaCheck } from './answer.ts';
import styles from './KanaQuestion.module.css';

/** The word as the notebook writes it, with its reading: 続きます（つづきます）. */
function withReading(word: Word): string {
  const { kanji, kana } = displayForm(word);
  return kanji === undefined ? kana : `${kanji}（${kana}）`;
}

/** The note after a right answer that wasn't the card's exact spelling, if any. */
function answerNote(word: Word, check: KanaCheck, t: Translate): ReactNode {
  if (!check.correct || check.matched === undefined) return undefined;
  if (check.matched.id !== word.id) {
    return <JaText text={t('kana_other_word', { word: withReading(word) })} />;
  }
  if (check.spelled !== undefined)
    return <JaText text={t('kana_spelled', { word: check.spelled })} />;
  return undefined;
}

/**
 * One kana typing question (SPEC §9.3). Reading: the kanji form without furigana → its reading.
 * Recall: a meaning → the word. Romaji converts as you type; Enter or Check submits. After the
 * answer the word shows with its furigana.
 */
export function KanaQuestion({ card, word, allWords, onAnswer }: QuestionProps) {
  const t = useT();
  const { lang } = useLang();
  const reading = card.skill === 'reading';
  const expected = expectedKana(word);
  const [value, setValue] = useState('');
  const [hinted, setHinted] = useState(false);
  const [check, setCheck] = useState<KanaCheck | null>(null);
  const answered = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (answered.current) return;
    const given = finishKana(value, expected);
    // nothing typed yet: nothing to judge
    if (given === '') return;
    answered.current = true;
    const result = checkKana({ given, word, skill: card.skill, allWords, lang });
    setValue(given);
    setCheck(result);
    const note = answerNote(word, result, t);
    onAnswer({
      correct: result.correct,
      hinted,
      given,
      expected,
      expectedLang: 'ja',
      ...(note !== undefined && { explanation: note }),
      // reading mode reveals the meaning, which needs a moment to be read
      reveals: reading,
    });
  };

  const showHint = () => {
    setHinted(true);
    inputRef.current?.focus();
  };

  const done = check !== null;
  const state = check === null ? undefined : check.correct ? 'correct' : 'wrong';
  const meaning = meaningText(word, lang);
  const pairs = furiganaFor(displayForm(word));
  return (
    <div className={styles.question}>
      <div className={styles.prompt} data-kana-prompt data-word-id={word.id}>
        {reading ? (
          <>
            <Ruby
              pairs={pairs}
              readings={done}
              className={`${styles.promptJa} ${styles.withRuby}`}
            />
            {/* the line is there from the start, so nothing moves when the meaning appears */}
            <span className={styles.meaning} lang={meaning.lang} data-kana-meaning>
              {done ? meaning.text : '\u00a0'}
            </span>
          </>
        ) : (
          <>
            <span className={styles.promptMeaning} lang={meaning.lang}>
              {meaning.text}
            </span>
            {done && (
              <span className={styles.reveal} data-kana-reveal>
                <Ruby pairs={pairs} className={styles.withRuby} />
              </span>
            )}
          </>
        )}
      </div>
      <p className={styles.ask}>{t(reading ? 'kana_ask_reading' : 'kana_ask_word')}</p>

      <form className={styles.answer} onSubmit={submit}>
        <div className={styles.field}>
          <KanaInput
            inputRef={inputRef}
            expected={expected}
            value={value}
            onValue={setValue}
            locked={done}
            className={styles.input}
            aria-label={t('kana_answer_label')}
            placeholder={t('kana_placeholder')}
            enterKeyHint="go"
            data-state={state}
            autoFocus
          />
          {state !== undefined && (
            <span className={styles.mark} data-mark={state} aria-hidden="true">
              {state === 'correct' ? '◯' : '✕'}
            </span>
          )}
        </div>
        <button type="submit" className={styles.check} disabled={done}>
          {t('kana_check')}
        </button>
      </form>

      <div className={styles.hintRow}>
        {hinted ? (
          <p className={styles.hint} data-hint>
            <JaText text={t('kana_hint_text', { kana: hintKana(word) })} />
          </p>
        ) : (
          // gone once answered; the row keeps its height, so nothing moves
          !done && (
            <button type="button" className={styles.hintButton} onClick={showHint}>
              {t('kana_hint')}
            </button>
          )
        )}
      </div>
    </div>
  );
}
