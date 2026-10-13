import { isForm, type Conjugated, type ConjugationForm } from '../../lib/conjugate.ts';
import { answerKey } from '../../lib/kana.ts';

/** Conjugation drill (SPEC §9.4), the pure part shared by the question, the choices and the rule. */

/** A card's form as a form id; undefined for anything else. */
export function asForm(form: string | undefined): ConjugationForm | undefined {
  return isForm(form) ? form : undefined;
}

/**
 * The form the verb is shown in: ます, as in the notebook (SPEC §8.3), except when ます is the
 * question, which shows the dictionary form.
 */
export function promptForm(form: ConjugationForm): ConjugationForm {
  return form === 'ます' ? '辞書形' : 'ます';
}

/** A form as written: 書いて, or the kana for a word without kanji. */
export const written = (c: Conjugated): string => c.kanji ?? c.kana;

/** A form with its reading, for the feedback line: 来ない（こない）. */
export const withReading = (c: Conjugated): string =>
  c.kanji === undefined ? c.kana : `${c.kanji}（${c.kana}）`;

/**
 * A typed answer (already finished with `finishKana`): right when its kana matches on the
 * answer key (script doesn't matter, long vowels must be right, SPEC §9.3) or it is exactly the
 * written form. こない and 来ない both count.
 */
export function checkTyped(given: string, expected: Conjugated): boolean {
  const text = given.normalize('NFKC').replace(/\s+/g, '');
  if (text === '') return false;
  if (expected.kanji !== undefined && text === expected.kanji) return true;
  return answerKey(text) === answerKey(expected.kana);
}
