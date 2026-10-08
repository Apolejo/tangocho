/**
 * Character classes for Japanese text, by Unicode range. Every function takes one
 * code point (a one-character string); use `chars()` to split a string into code points.
 */

/** Splits into code points, so kanji outside the BMP (𠮟) stay whole. */
export function chars(text: string): string[] {
  return Array.from(text);
}

const codePoint = (ch: string): number => ch.codePointAt(0) ?? -1;

/** CJK unified ideographs (plus extension A, compatibility and supplementary planes). */
export function isKanji(ch: string): boolean {
  const cp = codePoint(ch);
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2ffff)
  );
}

export function isHiragana(ch: string): boolean {
  const cp = codePoint(ch);
  return (cp >= 0x3041 && cp <= 0x3096) || (cp >= 0x3099 && cp <= 0x309f);
}

/** Katakana including ー (U+30FC) and ヶ (U+30F6), but not the middle dot ・. */
export function isKatakana(ch: string): boolean {
  const cp = codePoint(ch);
  return (cp >= 0x30a1 && cp <= 0x30fa) || (cp >= 0x30fc && cp <= 0x30ff);
}

export function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch);
}

/** 々 and ヶ never stand alone: for furigana they belong to the kanji run before them (SPEC §5.4). */
export function isKanjiRunChar(ch: string): boolean {
  return isKanji(ch) || ch === '々' || ch === 'ヶ';
}

/** What the `kana` field may contain: kana and ー (SPEC §5.5). */
export function isKanaFieldChar(ch: string): boolean {
  return isKana(ch);
}

/** What the `kanji` field may contain: kanji, kana, ー, 々 and ヶ (SPEC §5.5). */
export function isKanjiFieldChar(ch: string): boolean {
  return isKanji(ch) || isKana(ch) || ch === '々' || ch === 'ヶ';
}

export function hasKanji(text: string): boolean {
  return chars(text).some(isKanji);
}

/** The run of kana at the end of a written form (the okurigana), '' if none. */
export function trailingKana(text: string): string {
  const cs = chars(text);
  let i = cs.length;
  while (i > 0 && isKana(cs[i - 1] ?? '') && !isKanjiRunChar(cs[i - 1] ?? '')) i--;
  return cs.slice(i).join('');
}
