import { z } from 'zod';
import { deckId, wordsInDecks, type NotebookDeck } from '../data/decks.ts';
import type { Word } from '../data/schema.ts';
import {
  DIRECTIONS,
  INPUT_MODES,
  KANA_MODES,
  type GameId,
  type InputMode,
  type Minigame,
  type RoundOptions,
} from '../games/types.ts';
import type { Lang } from '../i18n/lang.ts';
import { FORMS } from '../lib/conjugate.ts';
import { eligibleWords } from './plan.ts';
import { ROUND_SIZES, type RoundSize } from './queue.ts';

/** The setup screen's choice (SPEC §7.3), remembered per game in localStorage. */
export interface SetupChoice {
  deckIds: string[];
  size: RoundSize;
  options: RoundOptions;
}

/** The choice before anything is stored; the input mode depends on the device (SPEC §9.4). */
export function defaultSetup(inputMode: InputMode = 'typing'): SetupChoice {
  return {
    deckIds: ['all'],
    size: 10,
    options: {
      furigana: true,
      direction: 'forward',
      mode: 'reading',
      inputMode,
      forms: [...FORMS],
    },
  };
}

export const DEFAULT_SETUP: SetupChoice = defaultSetup();

/** Four choices on a phone or tablet (a touch screen is the main pointer), typing elsewhere. */
export function deviceInputMode(): InputMode {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'choices' : 'typing';
  } catch {
    return 'typing';
  }
}

function storedSetup(defaults: SetupChoice) {
  const d = defaults.options;
  return z.object({
    deckIds: z.array(z.string()).catch([]),
    size: z.literal(ROUND_SIZES).catch(defaults.size),
    options: z
      .object({
        furigana: z.boolean().catch(d.furigana),
        direction: z.enum(DIRECTIONS).catch(d.direction),
        mode: z.enum(KANA_MODES).catch(d.mode),
        inputMode: z.enum(INPUT_MODES).catch(d.inputMode),
        forms: z.array(z.string()).catch([]),
      })
      .catch({ ...d, forms: [...d.forms] }),
  });
}

/**
 * Reads a stored choice; drops decks and forms that no longer exist and falls back to the
 * defaults. Forms come back in the engine's order; none left means all of them.
 */
export function parseSetup(
  raw: string | null,
  knownDeckIds: ReadonlySet<string>,
  defaults: SetupChoice = DEFAULT_SETUP,
): SetupChoice {
  let json: unknown;
  try {
    json = raw === null ? undefined : JSON.parse(raw);
  } catch {
    json = undefined;
  }
  const parsed = storedSetup(defaults).safeParse(json);
  if (!parsed.success) return defaults;
  const deckIds = [...new Set(parsed.data.deckIds.filter((id) => knownDeckIds.has(id)))];
  const forms = FORMS.filter((form) => parsed.data.options.forms.includes(form));
  return {
    deckIds: deckIds.length > 0 ? deckIds : defaults.deckIds,
    size: parsed.data.size,
    options: { ...parsed.data.options, forms: forms.length > 0 ? forms : defaults.options.forms },
  };
}

const storageKey = (game: GameId) => `tangocho:setup:${game}`;

export function loadSetup(game: GameId, knownDeckIds: ReadonlySet<string>): SetupChoice {
  const defaults = defaultSetup(deviceInputMode());
  try {
    return parseSetup(localStorage.getItem(storageKey(game)), knownDeckIds, defaults);
  } catch {
    return defaults;
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

/** The words a round with this setup can ask about: the eligible words of its decks. */
export function setupPool(
  game: Pick<Minigame, 'skillsFor' | 'eligible'>,
  choice: SetupChoice,
  decks: readonly NotebookDeck[],
  allWords: readonly Word[],
  now: Date,
): Word[] {
  const selected = decks.filter((d) => choice.deckIds.includes(deckId(d)));
  return eligibleWords(game, choice.options, wordsInDecks(selected, allWords, now));
}

export type SetupBlocker =
  | NonNullable<ReturnType<typeof unavailableReason>>
  | { key: 'setup_decks_none' | 'setup_pool_empty' | 'setup_forms_none' };

/** Why a round with this setup can't start, or undefined when it can. */
export function setupBlocker(
  game: Pick<
    Minigame,
    'skills' | 'eligible' | 'minPool' | 'available' | 'unavailableKey' | 'options'
  >,
  choice: SetupChoice,
  pool: readonly Word[],
  allWords: readonly Word[],
  lang: Lang,
): SetupBlocker | undefined {
  const reason = unavailableReason(game, allWords, lang);
  if (reason !== undefined) return reason;
  if (choice.deckIds.length === 0) return { key: 'setup_decks_none' };
  if (pool.length === 0) return { key: 'setup_pool_empty' };
  if (game.options.includes('forms') && choice.options.forms.length === 0) {
    return { key: 'setup_forms_none' };
  }
  return undefined;
}
