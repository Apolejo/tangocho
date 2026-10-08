import { createContext } from 'react';
import type { Lang } from './lang.ts';

export interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const LangContext = createContext<LangState | null>(null);
