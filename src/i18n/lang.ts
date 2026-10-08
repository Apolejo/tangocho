import { en, type MessageKey, type Messages } from './en.ts';
import { es } from './es.ts';

/** UI languages (SPEC §6). Pure helpers; the React side is in LangProvider.tsx and hooks.ts. */
export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_STORAGE_KEY = 'tangocho:lang';

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'es';
}

/** Browser language → UI language: `es*` → Spanish, anything else → English. */
export function detectLang(navigatorLanguage: string | undefined): Lang {
  return navigatorLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** The remembered choice if there is one, else the browser default. */
export function initialLang(stored: string | null | undefined, navigatorLanguage?: string): Lang {
  return isLang(stored) ? stored : detectLang(navigatorLanguage);
}

export function messagesFor(lang: Lang): Messages {
  return lang === 'es' ? es : en;
}

/** Fills `{name}` placeholders. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>) {
  return format(messagesFor(lang)[key], vars);
}
