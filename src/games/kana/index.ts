import type { Minigame } from '../types.ts';
import { hasKanjiForm } from './answer.ts';
import { KanaQuestion } from './KanaQuestion.tsx';

/** Kana typing (SPEC §9.3): `reading` (kanji → reading) or `recall` (meaning → word), by mode. */
export const kana: Minigame = {
  id: 'kana',
  nameKey: 'game_kana',
  nameJa: 'かな入力',
  descriptionKey: 'game_kana_desc',
  skills: ['reading', 'recall'],
  options: ['mode'],
  skillsFor: ({ mode }) => [mode],
  variant: ({ mode }) => mode,
  eligible: (word, skill) => skill === 'recall' || (skill === 'reading' && hasKanjiForm(word)),
  // any one word will do: available() says it better than a count
  minPool: 0,
  available: (allWords) => allWords.length > 0,
  unavailableKey: 'kana_unavailable',
  Question: KanaQuestion,
};
