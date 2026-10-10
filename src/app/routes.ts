/** Hash routes (SPEC §4: GitHub Pages has no fallback for client-side routes). Pure; see useHashRoute.ts. */
export type Route =
  | { name: 'notebook'; deckId: string }
  | { name: 'play' }
  | { name: 'game'; gameId: string }
  | { name: 'not-found'; path: string };

export const DEFAULT_DECK = 'all';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter((p) => p !== '');
  const [head, second] = parts;
  if (head === undefined || (head === 'notebook' && parts.length === 1)) {
    return { name: 'notebook', deckId: DEFAULT_DECK };
  }
  if (head === 'notebook' && parts.length === 2 && second !== undefined) {
    return { name: 'notebook', deckId: safeDecode(second) };
  }
  if (head === 'play' && parts.length === 1) return { name: 'play' };
  if (head === 'play' && parts.length === 2 && second !== undefined) {
    return { name: 'game', gameId: safeDecode(second) };
  }
  return { name: 'not-found', path };
}

export function notebookHref(deckId: string): string {
  return `#/notebook/${encodeURIComponent(deckId)}`;
}

export const PLAY_HREF = '#/play';

export function gameHref(gameId: string): string {
  return `${PLAY_HREF}/${encodeURIComponent(gameId)}`;
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
