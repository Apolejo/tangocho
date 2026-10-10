import type { GameId } from '../games/types.ts';
import type { RoundEvent } from './events.ts';

/**
 * Personal bests (SPEC §10.3), derived from the round events: one per game, deck selection, round
 * size and variant (the quiz direction). Practice rounds never count.
 */

export function bestKey(
  game: GameId,
  deckIds: readonly string[],
  size: number,
  variant: string,
): string {
  return [game, [...deckIds].sort().join('+'), size, variant].join('|');
}

export function roundKey(round: RoundEvent): string {
  return bestKey(round.game, round.deckIds, round.size, round.variant);
}

/** The best score for a key, leaving out one round (the one just played); undefined if none. */
export function personalBest(
  rounds: readonly RoundEvent[],
  key: string,
  excludeRoundId?: string,
): number | undefined {
  let best: number | undefined;
  for (const round of rounds) {
    if (round.practice || round.id === excludeRoundId || roundKey(round) !== key) continue;
    if (best === undefined || round.score > best) best = round.score;
  }
  return best;
}

/** 新記録: beats the previous best, or is the first round for the key with a score above 0. */
export function isNewRecord(score: number, previousBest: number | undefined): boolean {
  return score > 0 && (previousBest === undefined || score > previousBest);
}
