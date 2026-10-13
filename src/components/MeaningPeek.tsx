import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Word } from '../data/schema.ts';
import { useLang, useT } from '../i18n/hooks.ts';
import { meaningText } from '../i18n/localized.ts';
import styles from './MeaningPeek.module.css';

/**
 * Beside the word when the bubble fits on screen; else above it, where it covers only the
 * furigana, not the question or the answer; else below it.
 */
function place(bubble: HTMLSpanElement | null): void {
  if (bubble === null) return;
  bubble.dataset.placement = 'side';
  if (bubble.getBoundingClientRect().right <= document.documentElement.clientWidth) return;
  bubble.dataset.placement = 'above';
  if (bubble.getBoundingClientRect().top >= 0) return;
  bubble.dataset.placement = 'below';
}

/**
 * A question's word that shows its meaning when tapped (SPEC §8.3), in a bubble beside it. For
 * games whose question isn't about the meaning; looking never counts as a hint. The next tap
 * anywhere, or Esc, closes it.
 */
export function MeaningPeek({
  word,
  label,
  children,
}: {
  word: Word;
  /** The word as shown, for the button's name. */
  label: string;
  /** The word itself, usually a <Ruby>. */
  children: ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const meaning = meaningText(word, lang);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof Node && wrapRef.current?.contains(e.target))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={styles.peek}>
      <button
        type="button"
        className={styles.word}
        aria-expanded={open}
        aria-label={t('meaning_show', { word: label })}
        // a typed answer's field keeps its focus, so a phone keeps its keyboard up
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((was) => !was)}
        data-meaning-peek
      >
        {children}
      </button>
      {open && (
        <span
          ref={place}
          className={styles.bubble}
          lang={meaning.lang}
          aria-hidden="true"
          onClick={() => setOpen(false)}
          data-meaning-bubble
        >
          {meaning.text}
        </span>
      )}
      {/* screen readers hear the meaning when it opens */}
      <span className="visually-hidden" aria-live="polite" lang={meaning.lang}>
        {open ? meaning.text : ''}
      </span>
    </span>
  );
}
