import decksJson from '../../data/decks.json';
import { DecksFileSchema, WordsFileSchema, type Deck, type Word } from './schema.ts';

/**
 * The bundled data. `@words` is a Vite alias: data/words/ in the app, data/fixtures/ in the
 * e2e and test modes (SPEC §5.6). Files only organize things for humans; the app sees one list.
 */
const files = import.meta.glob('@words/*.json', { eager: true, import: 'default' });

export const words: readonly Word[] = Object.keys(files)
  .sort()
  .flatMap((file) => WordsFileSchema.parse(files[file]));

export const decks: readonly Deck[] = DecksFileSchema.parse(decksJson);
