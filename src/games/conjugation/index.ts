import { FORMS } from '../../lib/conjugate.ts';
import type { Minigame } from '../types.ts';
import { ConjugationQuestion } from './ConjugationQuestion.tsx';
import { isDrillable } from './drill.ts';

/**
 * Conjugation drill (SPEC §9.4): `conjugation`, verbs only. Each card carries a form, picked by
 * the queue among the selected ones.
 */
export const conjugation: Minigame = {
  id: 'conjugation',
  nameKey: 'game_conjugation',
  nameJa: '活用',
  descriptionKey: 'game_conjugation_desc',
  skills: ['conjugation'],
  options: ['forms', 'inputMode', 'furigana'],
  skillsFor: () => ['conjugation'],
  // typing and choices, and different form selections, are different games to beat
  variant: ({ inputMode, forms }) =>
    `${inputMode}|${FORMS.filter((f) => forms.includes(f)).join('+')}`,
  eligible: (word, skill) => skill === 'conjugation' && isDrillable(word),
  formsFor: (_word, { forms }) => forms,
  // no word count to reach: available() says it better ("needs at least one verb")
  minPool: 0,
  available: (allWords) => allWords.some(isDrillable),
  unavailableKey: 'conj_unavailable',
  Question: ConjugationQuestion,
};
