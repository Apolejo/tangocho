import type { Word } from '../data/schema.ts';
import { conjugate, FORMS } from './conjugate.ts';

/**
 * What the notebook shows for a word (SPEC §5.1, §7.2): verbs in ます form (automatic furigana),
 * everything else as stored. Falls back to the stored form when the ます form can't be derived.
 */
export function displayForm(word: Word): Pick<Word, 'kanji' | 'kana' | 'furigana'> {
  if (word.pos === 'verb') {
    const masu = conjugate(word, 'ます');
    if (masu !== undefined) return masu;
  }
  return { kanji: word.kanji, kana: word.kana, furigana: word.furigana };
}

/**
 * A verb the engine conjugates in every form: the notebook can show its forms (SPEC §7.2) and the
 * drill can ask about it (SPEC §9.4). The validator reports the verbs that aren't (SPEC §5.5).
 */
export function isConjugable(word: Word): boolean {
  return (
    word.pos === 'verb' &&
    word.verbGroup !== undefined &&
    FORMS.every((form) => conjugate(word, form) !== undefined)
  );
}
