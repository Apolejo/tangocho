import { kana } from './kana/index.ts';
import { quiz } from './quiz/index.ts';
import { sorter } from './sorter/index.ts';
import type { Minigame } from './types.ts';

/** Every playable game, in the order the game list shows them. */
export const GAMES: readonly Minigame[] = [quiz, sorter, kana];

export function gameById(id: string): Minigame | undefined {
  return GAMES.find((game) => game.id === id);
}
