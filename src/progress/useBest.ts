import { useEffect, useState } from 'react';
import type { GameId } from '../games/types.ts';
import { personalBest } from './bests.ts';
import { roundEvents } from './db.ts';

export type BestState = { status: 'loading' } | { status: 'ready'; best: number | undefined };

/** The personal best for a key (see bests.ts), read from the event log; optionally leaving one round out. */
export function useBest(game: GameId, key: string, excludeRoundId?: string): BestState {
  const [loaded, setLoaded] = useState<{ key: string; best: number | undefined }>();

  useEffect(() => {
    let alive = true;
    roundEvents(game).then(
      (rounds) => {
        if (alive) setLoaded({ key, best: personalBest(rounds, key, excludeRoundId) });
      },
      (error: unknown) => {
        console.warn('could not read personal bests', error);
        if (alive) setLoaded({ key, best: undefined });
      },
    );
    return () => {
      alive = false;
    };
  }, [game, key, excludeRoundId]);

  return loaded?.key === key ? { status: 'ready', best: loaded.best } : { status: 'loading' };
}
