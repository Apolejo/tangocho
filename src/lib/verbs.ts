import type { Word } from '../data/schema.ts';
import { chars } from './jp.ts';

/**
 * The ます form of a verb stored in dictionary form (SPEC §5.1, §7.2). The notebook shows verbs
 * this way; the conjugation engine (§11, M6) takes over from here.
 */

export interface VerbForm {
  kanji?: string;
  kana: string;
}

/** Group 1: the final う-row kana moves to the い-row before ます (書く → 書きます). */
const U_TO_I: Readonly<Record<string, string>> = {
  う: 'い',
  く: 'き',
  ぐ: 'ぎ',
  す: 'し',
  つ: 'ち',
  ぬ: 'に',
  ぶ: 'び',
  む: 'み',
  る: 'り',
};

interface Ending {
  kanaRemoved: number;
  kanaAdded: string;
  kanjiRemoved: number;
  kanjiAdded: string;
}

function ending(word: Pick<Word, 'kanji' | 'kana' | 'verbGroup'>): Ending | undefined {
  const { kanji, kana, verbGroup } = word;
  const cs = chars(kana);
  const last = cs.at(-1);
  if (last === undefined || cs.length < 2) return undefined;
  switch (verbGroup) {
    case 1: {
      const i = U_TO_I[last];
      if (i === undefined) return undefined;
      return { kanaRemoved: 1, kanaAdded: `${i}ます`, kanjiRemoved: 1, kanjiAdded: `${i}ます` };
    }
    case 2:
      if (last !== 'る') return undefined;
      return { kanaRemoved: 1, kanaAdded: 'ます', kanjiRemoved: 1, kanjiAdded: 'ます' };
    case 3:
      if (kana.endsWith('する')) {
        if (kanji !== undefined && !kanji.endsWith('する')) return undefined;
        return { kanaRemoved: 2, kanaAdded: 'します', kanjiRemoved: 2, kanjiAdded: 'します' };
      }
      if (kana === 'くる' || kana.endsWith('てくる') || kana.endsWith('でくる')) {
        // 来る keeps its kanji and changes the reading: 来ます (きます); 持ってくる → 持ってきます
        if (kanji === undefined || kanji.endsWith('くる')) {
          return { kanaRemoved: 2, kanaAdded: 'きます', kanjiRemoved: 2, kanjiAdded: 'きます' };
        }
        if (kanji.endsWith('る')) {
          return { kanaRemoved: 2, kanaAdded: 'きます', kanjiRemoved: 1, kanjiAdded: 'ます' };
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

const replaceEnd = (text: string, removed: number, added: string): string =>
  chars(text).slice(0, -removed).join('') + added;

/** undefined when the kana doesn't fit the group (the validator reports that case). */
export function masuForm(word: Pick<Word, 'kanji' | 'kana' | 'verbGroup'>): VerbForm | undefined {
  const e = ending(word);
  if (e === undefined) return undefined;
  const kana = replaceEnd(word.kana, e.kanaRemoved, e.kanaAdded);
  if (word.kanji === undefined) return { kana };
  const kanjiTail = chars(word.kanji).slice(-e.kanjiRemoved).join('');
  const kanaTail = chars(word.kana).slice(-e.kanjiRemoved).join('');
  if (kanjiTail !== kanaTail) return undefined;
  return { kanji: replaceEnd(word.kanji, e.kanjiRemoved, e.kanjiAdded), kana };
}

/**
 * What the notebook shows for a word: verbs in ます form (automatic furigana), everything else
 * as stored. Falls back to the stored form when the ます form can't be derived.
 */
export function displayForm(word: Word): Pick<Word, 'kanji' | 'kana' | 'furigana'> {
  if (word.pos === 'verb' && word.verbGroup !== undefined) {
    const masu = masuForm(word);
    if (masu !== undefined) return masu;
  }
  return { kanji: word.kanji, kana: word.kana, furigana: word.furigana };
}
