import { useLayoutEffect, useRef, type ComponentProps, type RefObject } from 'react';
import { typeKana } from '../lib/kana.ts';

/**
 * A text field that turns romaji into kana as you type, in the script of the expected answer
 * (SPEC §9.3). A Japanese keyboard (IME or flick input) composes its own text: nothing is
 * converted until the composition ends, and the Enter that confirms it doesn't submit.
 */
export function KanaInput({
  expected,
  value,
  onValue,
  locked,
  inputRef,
  onKeyDown,
  ...rest
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'ref'> & {
  /** The answer's kana: it decides hiragana or katakana at each position. */
  expected: string;
  value: string;
  onValue(value: string): void;
  /** Answered: no more typing, but the field keeps its focus, so a phone keeps its keyboard up. */
  locked: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const composing = useRef(false);
  const caret = useRef<number | null>(null);

  // converting changes the length, so the caret goes back to where the typing was
  useLayoutEffect(() => {
    const at = caret.current;
    caret.current = null;
    const input = inputRef.current;
    if (at !== null && input !== null && document.activeElement === input) {
      input.setSelectionRange(at, at);
    }
  });

  const convert = (input: HTMLInputElement) => {
    const next = typeKana(input.value, input.selectionEnd ?? input.value.length, expected);
    caret.current = next.caret;
    onValue(next.value);
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      lang="ja"
      value={value}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      aria-readonly={locked || undefined}
      onChange={(e) => {
        if (locked) return;
        if (composing.current) onValue(e.currentTarget.value);
        else convert(e.currentTarget);
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        if (!locked) convert(e.currentTarget);
      }}
      onKeyDown={(e) => {
        // 229: Safari reports the confirming Enter after the composition has already ended
        const confirming = composing.current || e.nativeEvent.isComposing || e.keyCode === 229;
        if (e.key === 'Enter' && confirming) e.preventDefault();
        onKeyDown?.(e);
      }}
    />
  );
}
