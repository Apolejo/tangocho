import type { Deck, DeckMatch, Word } from './schema.ts';

/** Decks are queries over words (SPEC §5.2): every given field must match; tags means all of them. */
export function matchesDeck(word: Word, match: DeckMatch): boolean {
  if (match.pos !== undefined && word.pos !== match.pos) return false;
  if (match.verbGroup !== undefined && word.verbGroup !== match.verbGroup) return false;
  if (match.tags !== undefined && !match.tags.every((tag) => word.tags.includes(tag))) return false;
  return true;
}

export type BuiltinDeckId = 'all' | 'new';

/** A tab in the notebook: a built-in deck, or one from data/decks.json. */
export type NotebookDeck = { kind: 'builtin'; id: BuiltinDeckId } | { kind: 'data'; deck: Deck };

export const BUILTIN_DECKS: readonly NotebookDeck[] = [
  { kind: 'builtin', id: 'all' },
  { kind: 'builtin', id: 'new' },
];

export function notebookDecks(decks: readonly Deck[]): NotebookDeck[] {
  return [...BUILTIN_DECKS, ...decks.map((deck): NotebookDeck => ({ kind: 'data', deck }))];
}

export function deckId(deck: NotebookDeck): string {
  return deck.kind === 'builtin' ? deck.id : deck.deck.id;
}

export const NEW_DAYS = 7;

/** "New this week": added today or in the 6 days before (local dates). */
export function isNewThisWeek(added: string, now: Date): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(added);
  if (!m) return false;
  const addedDay = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - addedDay.getTime()) / 86_400_000);
  return days >= 0 && days < NEW_DAYS;
}

export function wordsInDeck(deck: NotebookDeck, words: readonly Word[], now: Date): Word[] {
  switch (deck.kind) {
    case 'builtin':
      return deck.id === 'all' ? [...words] : words.filter((w) => isNewThisWeek(w.added, now));
    case 'data':
      return words.filter((w) => matchesDeck(w, deck.deck.match));
  }
}
