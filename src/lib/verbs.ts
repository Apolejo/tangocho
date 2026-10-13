import type { Word } from '../data/schema.ts';
import { conjugate } from './conjugate.ts';

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
