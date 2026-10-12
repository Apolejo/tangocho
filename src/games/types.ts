import type { ComponentType, ReactNode } from 'react';
import type { Word } from '../data/schema.ts';
import type { MessageKey } from '../i18n/en.ts';
import type { Lang } from '../i18n/lang.ts';

/**
 * The contract between the round shell (src/play/) and a game (SPEC §8.2). The shell owns the
 * flow, scoring, feedback and logging; a game renders one question and judges one answer.
 */

export type GameId = 'quiz' | 'sorter' | 'kana' | 'conjugation';

/** What a card trains (SPEC §8.1). */
export type Skill = 'meaning' | 'recall' | 'reading' | 'group' | 'conjugation';

/** A (word, skill) pair: the unit of spaced repetition (SPEC §8.1). */
export interface Card {
  wordId: string;
  skill: Skill;
  form?: string;
}

/** Quiz direction: forward = Japanese → meaning, reverse = meaning → Japanese. */
export const DIRECTIONS = ['forward', 'reverse', 'mixed'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Per-round options from the setup screen (SPEC §7.3). Input mode and forms arrive with M5 and M7. */
export interface RoundOptions {
  furigana: boolean;
  direction: Direction;
}

export type OptionKey = keyof RoundOptions;

export interface AnswerResult {
  correct: boolean;
  hinted: boolean;
  /** What was answered and what was expected, as text (for the live region and the log). */
  given: string;
  expected: string;
  /** The `lang` of `expected` when it isn't in the UI language, e.g. 'ja'. */
  expectedLang?: string;
  /**
   * The rule behind the answer, shown with the feedback (a node, so Japanese inside it can carry
   * lang="ja"). A correct answer with a rule stays up longer, so the rule can be read.
   */
  explanation?: ReactNode;
}

export interface QuestionProps {
  card: Card;
  word: Word;
  /** Every eligible word of the round's decks, e.g. for distractors. */
  pool: readonly Word[];
  /** Every word in the data, for when the decks alone can't supply enough. */
  allWords: readonly Word[];
  options: RoundOptions;
  /** Seeds the question's own randomness (option order, distractors), so rendering stays pure. */
  seed: number;
  /** Call exactly once. */
  onAnswer(result: AnswerResult): void;
}

export interface Minigame {
  id: GameId;
  nameKey: MessageKey;
  /** Japanese subtitle on the game card. */
  nameJa: string;
  descriptionKey: MessageKey;
  skills: readonly Skill[];
  /** Which option controls the setup screen shows. */
  options: readonly OptionKey[];
  /** The skills a round trains with these options; the queue picks one per card. */
  skillsFor(options: RoundOptions): readonly Skill[];
  /** The part of the personal-best key that comes from the options (SPEC §10.3). */
  variant(options: RoundOptions): string;
  eligible(word: Word, skill: Skill): boolean;
  /** Fewer eligible words in the whole list → the game is disabled with a message. */
  minPool: number;
  /** A game-specific check on the whole word list; `unavailableKey` says why it failed. */
  available(allWords: readonly Word[], lang: Lang): boolean;
  unavailableKey: MessageKey;
  Question: ComponentType<QuestionProps>;
}
