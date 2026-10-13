import { z } from 'zod';
import type { Word } from '../data/schema.ts';
import {
  DIRECTIONS,
  KANA_MODES,
  type GameId,
  type Minigame,
  type RoundOptions,
} from '../games/types.ts';
import type { Lang } from '../i18n/lang.ts';
import { ROUND_SIZES, type RoundSize } from './queue.ts';

/** The setup screen's choice (SPEC §7.3), remembered per game in localStorage. */
export interface SetupChoice {
  deckIds: string[];
  size: RoundSize;
  options: RoundOptions;
}

export const DEFAULT_SETUP: SetupChoice = {
  deckIds: ['all'],
  size: 10,
  options: { furigana: true, direction: 'forward', mode: 'reading' },
};

const StoredSetup = z.object({
  deckIds: z.array(z.string()).catch([]),
  size: z.literal(ROUND_SIZES).catch(DEFAULT_SETUP.size),
  options: z
    .object({
      furigana: z.boolean().catch(DEFAULT_SETUP.options.furigana),
      direction: z.enum(DIRECTIONS).catch(DEFAULT_SETUP.options.direction),
      mode: z.enum(KANA_MODES).catch(DEFAULT_SETUP.options.mode),
    })
    .catch(DEFAULT_SETUP.options),
});

/** Reads a stored choice; drops decks that no longer exist and falls back to the defaults. */
export function parseSetup(raw: string | null, knownDeckIds: ReadonlySet<string>): SetupChoice {
  let json: unknown;
  try {
    json = raw === null ? undefined : JSON.parse(raw);
  } catch {
    json = undefined;
  }
  const parsed = StoredSetup.safeParse(json);
  if (!parsed.success) return DEFAULT_SETUP;
  const deckIds = [...new Set(parsed.data.deckIds.filter((id) => knownDeckIds.has(id)))];
  return {
    deckIds: deckIds.length > 0 ? deckIds : DEFAULT_SETUP.deckIds,
    size: parsed.data.size,
    options: parsed.data.options,
  };
}

const storageKey = (game: GameId) => `tangocho:setup:${game}`;

export function loadSetup(game: GameId, knownDeckIds: ReadonlySet<string>): SetupChoice {
  try {
    return parseSetup(localStorage.getItem(storageKey(game)), knownDeckIds);
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(game: GameId, choice: SetupChoice): void {
  try {
    localStorage.setItem(storageKey(game), JSON.stringify(choice));
  } catch {
    // storage disabled: the choice lasts for this visit only
  }
}

/** Why a game can't run on the whole word list, or undefined when it can. */
export function unavailableReason(
  game: Pick<Minigame, 'skills' | 'eligible' | 'minPool' | 'available' | 'unavailableKey'>,
  allWords: readonly Word[],
  lang: Lang,
): { key: 'game_unavailable_pool'; n: number } | { key: Minigame['unavailableKey'] } | undefined {
  const eligible = allWords.filter((w) => game.skills.some((s) => game.eligible(w, s)));
  if (eligible.length < game.minPool) return { key: 'game_unavailable_pool', n: game.minPool };
  if (!game.available(allWords, lang)) return { key: game.unavailableKey };
  return undefined;
}
