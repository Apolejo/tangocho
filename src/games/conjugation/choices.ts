import { VERB_GROUPS, type Word } from '../../data/schema.ts';
import { conjugate, FORMS, type Conjugated, type ConjugationForm } from '../../lib/conjugate.ts';
import { chars } from '../../lib/jp.ts';
import { answerKey } from '../../lib/kana.ts';
import { shuffle, type Rng } from '../../lib/random.ts';
import { promptForm, written } from './drill.ts';

/**
 * Four-choice options for the conjugation drill (SPEC §9.4). Pure: the component renders what
 * this returns. Distractors are plausible mistakes: another group's rule, the wrong て/た sound
 * change, an exception ignored, a form built on the wrong stem. Never two alike, never a second
 * right answer.
 */

export const CHOICE_COUNT = 4;

type Verb = Pick<Word, 'kanji' | 'kana' | 'verbGroup'>;

/** The group 1 て and た endings, by the sound change each final kana takes (SPEC §11). */
const TE = ['って', 'いて', 'いで', 'して', 'んで'];
const TA = ['った', 'いた', 'いだ', 'した', 'んだ'];

/** い-row → う-row: undoing a ます stem the group 1 way (起き → 起く). */
const I_TO_U: Readonly<Record<string, string>> = {
  い: 'う',
  き: 'く',
  ぎ: 'ぐ',
  し: 'す',
  ち: 'つ',
  に: 'ぬ',
  び: 'ぶ',
  み: 'む',
  り: 'る',
};

/** Replaces the kana `from` at the end of both spellings; undefined if either doesn't end in it. */
function swapEnd(c: Conjugated, from: string, to: string): Conjugated | undefined {
  if (!c.kana.endsWith(from)) return undefined;
  const kana = c.kana.slice(0, c.kana.length - from.length) + to;
  if (c.kanji === undefined) return { kana };
  if (!c.kanji.endsWith(from)) return undefined;
  return { kanji: c.kanji.slice(0, c.kanji.length - from.length) + to, kana };
}

const add = (c: Conjugated, end: string): Conjugated =>
  c.kanji === undefined ? { kana: c.kana + end } : { kanji: c.kanji + end, kana: c.kana + end };

/** The plausible mistakes for one verb and form, best first (shuffled by the caller). */
export function mistakes(word: Verb, form: ConjugationForm): Conjugated[] {
  const out: (Conjugated | undefined)[] = [];
  // another group's rule: 帰る as group 2 → 帰ない, 食べる as group 1 → 食べって
  for (const group of VERB_GROUPS) {
    if (group !== word.verbGroup) out.push(conjugate({ ...word, verbGroup: group }, form));
  }
  const dict = conjugate(word, '辞書形');
  const masu = conjugate(word, 'ます');
  const nai = conjugate(word, 'ない');
  const correct = conjugate(word, form);
  if (dict === undefined || masu === undefined || nai === undefined || correct === undefined) {
    return [];
  }
  const masuStem = swapEnd(masu, 'ます', '');
  const naiStem = swapEnd(nai, 'ない', '');
  switch (form) {
    case 'ます':
    case 'ません':
    case 'ました':
    case 'ませんでした':
      out.push(add(dict, form)); // 書くます
      if (naiStem !== undefined) out.push(add(naiStem, form)); // 書かます, 来ます（こます）
      break;
    case 'ない':
      if (masuStem !== undefined) out.push(add(masuStem, 'ない')); // 書きない, 来ない（きない）
      out.push(add(dict, 'ない')); // 書くない
      if (word.verbGroup === 1) {
        out.push(swapEnd(dict, 'う', 'あない')); // 買あない
        // the rule without the exception: あらない
        if (word.kana === 'ある') out.push(swapEnd(dict, 'る', 'らない'));
      }
      break;
    case 'て':
    case 'た': {
      const endings = form === 'て' ? TE : TA;
      const end = endings.find((e) => correct.kana.endsWith(e));
      // the wrong sound change: 書って, 書んで, 泳いて; 行いて ignores the exception
      if (word.verbGroup === 1 && end !== undefined) {
        for (const other of endings) if (other !== end) out.push(swapEnd(correct, end, other));
      }
      if (masuStem !== undefined) out.push(add(masuStem, form)); // 書きて
      break;
    }
    case '辞書形':
      // the wrong way back from ます: 書きます → 書きる (group 2), 起きます → 起く (group 1)
      if (masuStem !== undefined) {
        out.push(add(masuStem, 'る'));
        const last = masuStem.kana.at(-1) ?? '';
        const u = I_TO_U[last];
        if (u !== undefined) out.push(swapEnd(masuStem, last, u));
      }
      break;
  }
  // a lone kana (す from します) isn't a believable answer
  return out.filter((c): c is Conjugated => c !== undefined && chars(c.kana).length >= 2);
}

/** The verb's other forms, for when there aren't three mistakes; never the form it's shown in. */
function otherForms(word: Verb, form: ConjugationForm): Conjugated[] {
  return FORMS.filter((f) => f !== form && f !== promptForm(form)).flatMap(
    (f) => conjugate(word, f) ?? [],
  );
}

export interface Choice {
  form: Conjugated;
  correct: boolean;
}

export interface Choices {
  options: Choice[];
  /**
   * Two options would look the same written (来ない read こない or きない), so the question shows
   * all of them in kana.
   */
  kanaOnly: boolean;
}

/**
 * Four options with exactly one correct: mistakes first, then the verb's other forms. No two
 * options share their kana; undefined when the engine can't conjugate the verb.
 */
export function buildChoices({
  word,
  form,
  rng,
}: {
  word: Verb;
  form: ConjugationForm;
  rng: Rng;
}): Choices | undefined {
  const correct = conjugate(word, form);
  if (correct === undefined) return undefined;
  const seen = new Set([answerKey(correct.kana)]);
  const distractors: Conjugated[] = [];
  for (const tier of [mistakes(word, form), otherForms(word, form)]) {
    for (const candidate of shuffle(tier, rng)) {
      if (distractors.length === CHOICE_COUNT - 1) break;
      const key = answerKey(candidate.kana);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(candidate);
    }
  }
  const options = shuffle(
    [{ form: correct, correct: true }, ...distractors.map((d) => ({ form: d, correct: false }))],
    rng,
  );
  const shown = new Set(options.map((o) => written(o.form)));
  return { options, kanaOnly: shown.size < options.length };
}
