import type { Word } from '../../data/schema.ts';
import type { Lang } from '../../i18n/lang.ts';
import { meaningText } from '../../i18n/localized.ts';
import { chars } from '../../lib/jp.ts';
import { answerKey } from '../../lib/kana.ts';
import { displayForm } from '../../lib/verbs.ts';
import type { Skill } from '../types.ts';

/** Kana typing answers (SPEC §9.3). Pure: the question component only renders what these return. */

/** Reading mode asks for the reading of a kanji form, so it needs one. */
export const hasKanjiForm = (word: Word): boolean => word.kanji !== undefined;

/** The answer as shown and hinted: the kana the notebook shows (verbs in ます form, SPEC §8.3). */
export const expectedKana = (word: Word): string => displayForm(word).kana;

/** The hint: the answer's first kana. */
export const hintKana = (word: Word): string => chars(expectedKana(word))[0] ?? '';

/** Every written form that counts: the kana and the exact kanji form, verbs in ます and dictionary form. */
export function acceptedForms(word: Word): string[] {
  const shown = displayForm(word);
  const forms = [shown.kana, shown.kanji, word.kana, word.kanji];
  return [...new Set(forms.filter((form) => form !== undefined))];
}

const normalize = (text: string): string =>
  text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Words whose meaning reads the same in this language can't be told apart from the prompt. */
function sameMeaning(a: Word, b: Word, lang: Lang): boolean {
  const ma = meaningText(a, lang);
  const mb = meaningText(b, lang);
  return ma.lang === mb.lang && normalize(ma.text) === normalize(mb.text);
}

export interface KanaCheck {
  correct: boolean;
  /** The word the answer matched: the card's, or in recall mode one with the same meaning. */
  matched?: Word;
  /** A right answer written differently (another script, a vowel for ー): how it's written. */
  spelled?: string;
}

/**
 * Judges a finished answer (`finishKana`). Right when it matches an accepted form of the word on
 * `answerKey`; in recall mode, a word with the same meaning counts too (続く and 続ける are both
 * "continuar"). Sharing one gloss isn't enough: アパート and マンション are different apartments.
 */
export function checkKana({
  given,
  word,
  skill,
  allWords,
  lang,
}: {
  given: string;
  word: Word;
  skill: Skill;
  allWords: readonly Word[];
  lang: Lang;
}): KanaCheck {
  const key = answerKey(given);
  if (key === '') return { correct: false };
  const twins =
    skill === 'recall'
      ? allWords.filter((w) => w.id !== word.id && sameMeaning(word, w, lang))
      : [];
  for (const candidate of [word, ...twins]) {
    const forms = acceptedForms(candidate);
    const form = forms.find((f) => answerKey(f) === key);
    if (form === undefined) continue;
    return { correct: true, matched: candidate, ...(!forms.includes(given) && { spelled: form }) };
  }
  return { correct: false };
}
