/**
 * Which font slices the service worker precaches (SPEC §4). Fontsource splits each font into
 * slices by unicode-range, and the browser fetches a slice only for the characters on screen.
 * Offline there is nothing to fetch, so the app precaches every slice that covers a character
 * it can show (its words, its UI text, every kana) and leaves the rest of Japanese out: about a
 * third of the size. New words that bring new kanji bring their slices with the next deploy.
 * Pure helpers for vite.config.ts.
 */

export type Range = readonly [from: number, to: number];

/** `U+0-FF, U+131, U+4??` → code point ranges (any case; `?` is any hex digit). */
export function parseUnicodeRange(text: string): Range[] {
  return text
    .split(',')
    .map((part) => part.trim().replace(/^u\+/i, ''))
    .filter((part) => part !== '')
    .map((part): Range => {
      if (part.includes('?')) {
        return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'f'), 16)];
      }
      const [from = '', to = from] = part.split('-');
      return [parseInt(from, 16), parseInt(to, 16)];
    });
}

const fileName = (url: string): string => url.split(/[/\\]/).pop() ?? url;

/**
 * Each woff2 file an `@font-face` of the built CSS points to, by file name, with its ranges. A face
 * without a unicode-range covers everything; one inlined as a data: URL has no file to cache.
 */
export function fontFaceRanges(css: string): Map<string, Range[]> {
  const faces = new Map<string, Range[]>();
  for (const [, body = ''] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const range = /unicode-range\s*:\s*([^;]+)/i.exec(body)?.[1];
    const ranges = range === undefined ? [[0, 0x10ffff] as const] : parseUnicodeRange(range);
    for (const [, url = ''] of body.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
      if (!url.startsWith('data:')) faces.set(fileName(url), ranges);
    }
  }
  return faces;
}

/** Every code point in the texts. */
export function codePointsOf(texts: Iterable<string>): Set<number> {
  const points = new Set<number>();
  for (const text of texts) for (const char of text) points.add(char.codePointAt(0) ?? 0);
  return points;
}

/**
 * Always worth having offline, whatever the sources say: printable ASCII, CJK punctuation with
 * every hiragana and katakana (conjugation and typed answers make kana the sources don't spell),
 * and fullwidth forms.
 */
export const ALWAYS: readonly Range[] = [
  [0x20, 0x7e],
  [0x3000, 0x30ff],
  [0xff00, 0xffef],
];

export function covers(ranges: readonly Range[], points: ReadonlySet<number>): boolean {
  if (ranges.some(([from, to]) => ALWAYS.some(([a, b]) => from <= b && a <= to))) return true;
  for (const point of points) {
    if (ranges.some(([from, to]) => point >= from && point <= to)) return true;
  }
  return false;
}

/**
 * Splits precache entries into the ones to keep and the font slices to leave out. Anything that
 * isn't a woff2, and a woff2 the CSS doesn't describe, is kept.
 */
export function selectFontSlices<Entry extends { url: string }>(
  entries: readonly Entry[],
  faces: ReadonlyMap<string, readonly Range[]>,
  points: ReadonlySet<number>,
): { kept: Entry[]; dropped: Entry[] } {
  const kept: Entry[] = [];
  const dropped: Entry[] = [];
  for (const entry of entries) {
    const ranges = entry.url.endsWith('.woff2') ? faces.get(fileName(entry.url)) : undefined;
    if (ranges === undefined || covers(ranges, points)) kept.push(entry);
    else dropped.push(entry);
  }
  return { kept, dropped };
}
