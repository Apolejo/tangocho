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
