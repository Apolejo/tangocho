import type { Word } from '../data/schema.ts';
import type { Lang } from './lang.ts';

/** Picks the text in the current language, falling back to the other one (SPEC §5.1 meaning). */
export function pickLocalized<T>(
  texts: { readonly en?: T; readonly es?: T },
  lang: Lang,
): { lang: Lang; value: T } | undefined {
  const own = texts[lang];
  if (own !== undefined) return { lang, value: own };
  const other: Lang = lang === 'en' ? 'es' : 'en';
  const fallback = texts[other];
  return fallback === undefined ? undefined : { lang: other, value: fallback };
}

/** A word's glosses in the UI language, else in the other one. */
export function glosses(word: Word, lang: Lang): { lang: Lang; glosses: readonly string[] } {
  const own = word.meaning[lang];
  if (own !== undefined && own.length > 0) return { lang, glosses: own };
  const other: Lang = lang === 'en' ? 'es' : 'en';
  return { lang: other, glosses: word.meaning[other] ?? [] };
}

/** The meaning as shown: every gloss, joined like the notebook does. */
export function meaningText(word: Word, lang: Lang): { lang: Lang; text: string } {
  const g = glosses(word, lang);
  return { lang: g.lang, text: g.glosses.join(', ') };
}
