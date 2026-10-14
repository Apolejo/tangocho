import type { Word } from '../data/schema.ts';
import { SKILLS, type Minigame, type Skill } from '../games/types.ts';
import { cardKey, type CardStates } from './srs.ts';

/**
 * Mastery levels from FSRS stability, in days (SPEC §10.5): New (never answered), Learning
 * (under 3), Familiar (3 to under 21), Mastered (21 or more). Pure.
 */

export const FAMILIAR_DAYS = 3;
export const MASTERED_DAYS = 21;

export const LEVELS = ['new', 'learning', 'familiar', 'mastered'] as const;
export type MasteryLevel = (typeof LEVELS)[number];

/** A card's level from its stability; undefined for a card never answered. */
export function masteryLevel(stability: number | undefined): MasteryLevel {
  if (stability === undefined) return 'new';
  if (stability < FAMILIAR_DAYS) return 'learning';
  if (stability < MASTERED_DAYS) return 'familiar';
  return 'mastered';
}

type GameSkills = Pick<Minigame, 'skills' | 'eligible'>;

/** The skills some game can train on a word: its cards. */
export function trainableSkills(word: Word, games: readonly GameSkills[]): Skill[] {
  return SKILLS.filter((skill) =>
    games.some((game) => game.skills.includes(skill) && game.eligible(word, skill)),
  );
}

export type MasteryCounts = Record<MasteryLevel, number> & { total: number };

/** How many of the words' cards are at each level (SPEC §10.5: mastery per deck counts cards). */
export function deckMastery(
  words: readonly Word[],
  games: readonly GameSkills[],
  cards: CardStates,
): MasteryCounts {
  const counts: MasteryCounts = { new: 0, learning: 0, familiar: 0, mastered: 0, total: 0 };
  for (const word of words) {
    for (const skill of trainableSkills(word, games)) {
      counts[masteryLevel(cards.get(cardKey(word.id, skill))?.fsrs.stability)]++;
      counts.total++;
    }
  }
  return counts;
}
