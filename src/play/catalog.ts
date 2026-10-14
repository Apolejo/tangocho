import { deckId, notebookDecks } from '../data/decks.ts';
import { decks } from '../data/load.ts';

/** The decks a round can use, as the notebook shows them. */
export const DECKS = notebookDecks(decks);
export const KNOWN_DECKS: ReadonlySet<string> = new Set(DECKS.map(deckId));
/** "New this week" is relative to when the app was opened, as in the notebook. */
export const OPENED_AT = new Date();
