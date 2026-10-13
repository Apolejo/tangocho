import { toHiragana, toKana, toKatakana, toRomaji } from 'wanakana';
import { chars, isHiragana, isKana, isKatakana } from './jp.ts';

/**
 * Typed answers in kana (SPEC §9.3), as pure functions: romaji converts while typing, submitting
 * finishes the conversion, and answers are compared on one key. The input component only adds
 * the DOM part (composition and the caret).
 */

type Script = 'hiragana' | 'katakana';

/** Romaji plus the marks WanaKana converts (- → ー, n' → ん). Kana and kanji are left alone. */
const ROMAJI_RUN = /[\x21-\x7e]+/g;

/** The script at each position of the expected kana; ー and anything else follow the kana before. */
function scriptsOf(expected: string): Script[] {
  const scripts: Script[] = [];
  for (const ch of chars(expected)) {
    const before = scripts.at(-1) ?? 'hiragana';
    scripts.push(
      ch === 'ー' ? before : isKatakana(ch) ? 'katakana' : isHiragana(ch) ? 'hiragana' : before,
    );
  }
  return scripts;
}

/**
 * Converts each run of romaji, giving each kana it makes the script the expected answer has at
 * that position: kopi-suru → コピーする, keshigomu → けしゴム. Live, a trailing n waits for the
 * next letter (kan → かn → かな or かん); finishing converts it.
 */
function convertRomaji(text: string, expected: string, finish: boolean): string {
  const scripts = scriptsOf(expected);
  const scriptAt = (i: number): Script => scripts[i] ?? scripts.at(-1) ?? 'hiragana';
  let out = '';
  let from = 0;
  for (const match of text.matchAll(ROMAJI_RUN)) {
    out += text.slice(from, match.index);
    // lower case: WanaKana turns upper-case romaji into katakana, and phones capitalize
    const kana = finish
      ? toKana(match[0].toLowerCase())
      : toKana(match[0], { IMEMode: 'toHiragana' });
    let position = chars(out).length;
    for (const ch of chars(kana)) {
      out += scriptAt(position++) === 'katakana' && isHiragana(ch) ? toKatakana(ch) : ch;
    }
    from = match.index + match[0].length;
  }
  return out + text.slice(from);
}

export interface Typed {
  value: string;
  caret: number;
}

/**
 * The input after a change: the text before the caret converts, so editing in the middle works.
 * Kana and kanji from a Japanese keyboard pass through as typed.
 */
export function typeKana(raw: string, caret: number, expected: string): Typed {
  const head = convertRomaji(raw.slice(0, caret).normalize('NFKC'), expected, false);
  return { value: head + raw.slice(caret), caret: head.length };
}

/**
 * The answer as submitted: no spaces, and the conversion finished in the expected answer's
 * script, so a trailing n becomes ん or ン (kaishain → かいしゃいん; sarari-man → サラリーマン).
 */
export function finishKana(raw: string, expected: string): string {
  return convertRomaji(raw.normalize('NFKC').replace(/\s+/g, ''), expected, true);
}

const VOWELS: Readonly<Record<string, string>> = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };

/** ー becomes the vowel it lengthens: コーヒー → コおヒい, so koohii and ko-hi- both match. */
function spellOutLongVowels(text: string): string {
  let out = '';
  let vowel: string | undefined;
  for (const ch of chars(text)) {
    if (ch === 'ー' && vowel !== undefined) {
      out += vowel;
      continue;
    }
    out += ch;
    vowel = isKana(ch) ? VOWELS[toRomaji(ch).slice(-1)] : undefined;
  }
  return out;
}

/**
 * What answers are compared on (SPEC §9.3): WanaKana's toHiragana after ー is spelled out as the
 * vowel it lengthens. The script doesn't matter (コピーする = こぴーする); long vowels must be
 * right (とおい ≠ とうい, センセー ≠ せんせい, コーヒー ≠ kouhii). Kanji stay as they are.
 */
export function answerKey(text: string): string {
  return toHiragana(spellOutLongVowels(text.normalize('NFKC').replace(/\s+/g, '')), {
    convertLongVowelMark: false,
  });
}
