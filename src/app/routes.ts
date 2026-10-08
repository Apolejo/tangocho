/** Hash routes (SPEC §4: GitHub Pages has no fallback for client-side routes). Pure; see useHashRoute.ts. */
export type Route = { name: 'notebook'; deckId: string } | { name: 'not-found'; path: string };

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
  return { name: 'not-found', path };
}

export function notebookHref(deckId: string): string {
  return `#/notebook/${encodeURIComponent(deckId)}`;
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
