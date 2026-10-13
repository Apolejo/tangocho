import type { Word } from '../../data/schema.ts';
import type { Lang } from '../../i18n/lang.ts';
import { meaningText } from '../../i18n/localized.ts';
import { shuffle, type Rng } from '../../lib/random.ts';
import { displayForm } from '../../lib/verbs.ts';
import type { Skill } from '../types.ts';

/** Quick quiz options (SPEC §9.1). Pure: the component only renders what this returns. */

export const CHOICE_COUNT = 4;

/** The Japanese as shown without furigana: verbs in ます form (SPEC §8.3). */
export function writtenForm(word: Word): string {
  const form = displayForm(word);
  return form.kanji ?? form.kana;
}

/** Text compared case- and width-insensitively. */
const normalize = (text: string): string =>
  text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** A gloss without its parenthesized details: "tomar (fotos, videos)" → "tomar". */
const glossCore = (gloss: string): string => normalize(gloss.replace(/[(（][^)）]*[)）]/g, ''));

/**
 * Whether `other` could also be a right answer for `target`: they share a gloss in either
 * language (いる and ある both "to exist"), or they look the same in Japanese (いる "to exist"
 * and いる "to need").
 */
export function conflicts(target: Word, other: Word): boolean {
  if (writtenForm(target) === writtenForm(other)) return true;
  for (const lang of ['en', 'es'] as const) {
    const mine = new Set((target.meaning[lang] ?? []).map(glossCore));
    if ((other.meaning[lang] ?? []).some((g) => mine.has(glossCore(g)))) return true;
  }
  return false;
}

export interface Choice {
  word: Word;
  correct: boolean;
}

export interface ChoiceInput {
  target: Word;
  /** `meaning`: the options are meanings; `recall`: the options are Japanese words. */
  skill: Skill;
  /** The round's words (the selected decks). */
  pool: readonly Word[];
  allWords: readonly Word[];
  lang: Lang;
  rng: Rng;
}

/**
 * Four options with exactly one correct, never two with the same displayed text, never a
 * distractor that could also be right. Distractors prefer the same part of speech from the
 * selected decks, then from any deck, then any word from the decks, then any word at all.
 */
export function buildChoices({ target, skill, pool, allWords, lang, rng }: ChoiceInput): Choice[] {
  const shown = (w: Word): string =>
    skill === 'recall' ? writtenForm(w) : normalize(meaningText(w, lang).text);
  const tiers = [
    pool.filter((w) => w.pos === target.pos),
    allWords.filter((w) => w.pos === target.pos),
    pool,
    allWords,
  ];
  const seen = new Set([shown(target)]);
  const distractors: Word[] = [];
  for (const tier of tiers) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    for (const w of shuffle(tier, rng)) {
      if (distractors.length === CHOICE_COUNT - 1) break;
      if (w.id === target.id || conflicts(target, w)) continue;
      const text = shown(w);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push(w);
    }
  }
  return shuffle(
    [{ word: target, correct: true }, ...distractors.map((word) => ({ word, correct: false }))],
    rng,
  );
}

/** The quiz needs at least four distinct meanings in the whole word list (SPEC §9.1). */
export function quizAvailable(allWords: readonly Word[], lang: Lang): boolean {
  const meanings = new Set(allWords.map((w) => normalize(meaningText(w, lang).text)));
  return meanings.size >= CHOICE_COUNT;
}
