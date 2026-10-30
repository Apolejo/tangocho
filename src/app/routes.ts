/** Hash routes (SPEC §4: the static host needs no fallback rule for client-side routes). Pure; see useHashRoute.ts. */
export type Route =
  | { name: 'today' }
  | { name: 'notebook'; deckId: string }
  | { name: 'play' }
  | { name: 'game'; gameId: string; intent?: GameIntent }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'not-found'; path: string };

/**
 * A round to start at once: *Continue* from Today (a round with the remembered setup), or
 * *Practice these* from Stats (the game's weakest cards).
 */
export const GAME_INTENTS = ['continue', 'weakest'] as const;
export type GameIntent = (typeof GAME_INTENTS)[number];

const isIntent = (part: string): part is GameIntent =>
  (GAME_INTENTS as readonly string[]).includes(part);

export const DEFAULT_DECK = 'all';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter((p) => p !== '');
  const [head, second, third] = parts;
  if (head === undefined || (head === 'today' && parts.length === 1)) return { name: 'today' };
  if (head === 'stats' && parts.length === 1) return { name: 'stats' };
  if (head === 'settings' && parts.length === 1) return { name: 'settings' };
  if (head === 'notebook' && parts.length === 1) return { name: 'notebook', deckId: DEFAULT_DECK };
  if (head === 'notebook' && parts.length === 2 && second !== undefined) {
    return { name: 'notebook', deckId: safeDecode(second) };
  }
  if (head === 'play' && parts.length === 1) return { name: 'play' };
  if (head === 'play' && parts.length === 2 && second !== undefined) {
    return { name: 'game', gameId: safeDecode(second) };
  }
  if (head === 'play' && parts.length === 3 && second !== undefined && third !== undefined) {
    if (isIntent(third)) return { name: 'game', gameId: safeDecode(second), intent: third };
  }
  return { name: 'not-found', path };
}

export function notebookHref(deckId: string): string {
  return `#/notebook/${encodeURIComponent(deckId)}`;
}

export const PLAY_HREF = '#/play';

export function gameHref(gameId: string, intent?: GameIntent): string {
  const href = `${PLAY_HREF}/${encodeURIComponent(gameId)}`;
  return intent === undefined ? href : `${href}/${intent}`;
}

export const TODAY_HREF = '#/';
export const STATS_HREF = '#/stats';
export const SETTINGS_HREF = '#/settings';

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
