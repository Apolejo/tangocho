import type { Minigame } from '../types.ts';
import { isSortable } from './rules.ts';
import { SorterQuestion } from './SorterQuestion.tsx';

/** Verb group sorter (SPEC §9.2): `group`, verbs only. */
export const sorter: Minigame = {
  id: 'sorter',
  nameKey: 'game_sorter',
  nameJa: 'グループ分け',
  descriptionKey: 'game_sorter_desc',
  skills: ['group'],
  options: ['furigana'],
  skillsFor: () => ['group'],
  variant: () => '',
  eligible: (word, skill) => skill === 'group' && isSortable(word),
  // no word count to reach: available() says it better ("needs at least one verb")
  minPool: 0,
  available: (allWords) => allWords.some(isSortable),
  unavailableKey: 'sorter_unavailable',
  Question: SorterQuestion,
};
