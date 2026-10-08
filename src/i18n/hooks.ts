import { useCallback, useContext } from 'react';
import { LangContext, type LangState } from './context.ts';
import type { MessageKey } from './en.ts';
import { translate } from './lang.ts';

export function useLang(): LangState {
  const state = useContext(LangContext);
  if (state === null) throw new Error('useLang needs a LangProvider above it');
  return state;
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** `t('key', { n })` in the current language. */
export function useT(): Translate {
  const { lang } = useLang();
  return useCallback<Translate>((key, vars) => translate(lang, key, vars), [lang]);
}
