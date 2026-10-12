import type { Minigame } from '../types.ts';
import { quizAvailable } from './choices.ts';
import { QuizQuestion } from './QuizQuestion.tsx';

/** Quick quiz (SPEC §9.1): `meaning` forward, `recall` in reverse, both when mixed. */
export const quiz: Minigame = {
  id: 'quiz',
  nameKey: 'game_quiz',
  nameJa: 'クイズ',
  descriptionKey: 'game_quiz_desc',
  skills: ['meaning', 'recall'],
  options: ['direction', 'furigana'],
  skillsFor: ({ direction }) =>
    direction === 'forward'
      ? ['meaning']
      : direction === 'reverse'
        ? ['recall']
        : ['meaning', 'recall'],
  variant: ({ direction }) => direction,
  eligible: (_word, skill) => skill === 'meaning' || skill === 'recall',
  minPool: 4,
  available: quizAvailable,
  unavailableKey: 'quiz_unavailable',
  Question: QuizQuestion,
};
