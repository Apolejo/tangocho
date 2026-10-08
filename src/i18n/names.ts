import type { NotebookDeck } from '../data/decks.ts';
import type { Translate } from './hooks.ts';
import type { Lang } from './lang.ts';
import { pickLocalized } from './localized.ts';

/** Japanese subtitles of the built-in decks; data decks carry theirs in decks.json. */
const BUILTIN_JA = { all: 'すべて', new: '今週' } as const;

export function deckName(deck: NotebookDeck, lang: Lang, t: Translate): string {
  if (deck.kind === 'builtin') return t(deck.id === 'all' ? 'deck_all' : 'deck_new');
  return pickLocalized(deck.deck.name, lang)?.value ?? deck.deck.id;
}

export function deckNameJa(deck: NotebookDeck): string | undefined {
  return deck.kind === 'builtin' ? BUILTIN_JA[deck.id] : deck.deck.name.ja;
}
