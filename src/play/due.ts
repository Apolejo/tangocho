import type { Word } from '../data/schema.ts';
import type { GameId, Minigame } from '../games/types.ts';
import { cardKey, isDue, type CardStates } from '../progress/srs.ts';

/** Today's due counts and the game *Continue* starts (SPEC §7.1). Pure. */

/** How many cards a round with these options could ask that are due now. */
export function dueCount(
  game: Pick<Minigame, 'skillsFor' | 'eligible'>,
  options: Parameters<Minigame['skillsFor']>[0],
  pool: readonly Word[],
  cards: CardStates,
  now: Date,
): number {
  const skills = game.skillsFor(options);
  let n = 0;
  for (const word of pool) {
    for (const skill of skills) {
      if (!game.eligible(word, skill)) continue;
      const state = cards.get(cardKey(word.id, skill));
      if (state !== undefined && isDue(state, now)) n++;
    }
  }
  return n;
}

/**
 * The game *Continue* starts: the one with the most due cards (the first in the list on a tie);
 * with nothing due, the last game played; with nothing played, the first. Only games that can
 * start count; undefined when none can.
 */
export function continueGame(
  games: readonly { id: GameId; due: number; playable: boolean }[],
  lastPlayed: GameId | undefined,
): GameId | undefined {
  const playable = games.filter((g) => g.playable);
  let best: (typeof playable)[number] | undefined;
  for (const game of playable)
    if (game.due > 0 && (best === undefined || game.due > best.due)) best = game;
  if (best !== undefined) return best.id;
  if (playable.some((g) => g.id === lastPlayed)) return lastPlayed;
  return playable[0]?.id;
}
