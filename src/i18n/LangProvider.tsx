import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LangContext } from './context.ts';
import { LANG_STORAGE_KEY, initialLang, type Lang } from './lang.ts';

function readStored(): string | null {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // private mode or storage disabled: the choice lasts for this visit only
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang(readStored(), navigator.language));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    store(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext value={value}>{children}</LangContext>;
}
