import { joinsBack, placeFurigana } from '../lib/furigana.ts';
import { chars, hasKanji, isKanaFieldChar, isKanjiFieldChar, trailingKana } from '../lib/jp.ts';
import { matchesDeck } from './decks.ts';
import type { Deck, Word } from './schema.ts';

/** Cross-field rules from SPEC §5.5, shared by the app and `npm run validate`. */

export type Level = 'error' | 'warning';

export interface Problem {
  level: Level;
  code: string;
  file: string;
  id?: string;
  message: string;
  hint?: string;
}

/** A parsed item together with the file it came from, for messages. */
export interface Located<T> {
  value: T;
  file: string;
}

/** Group 1 verbs that end in -iru/-eru (SPEC §5.5). Matched on kanji + kana together, as a suffix. */
export const GROUP1_EXCEPTIONS: ReadonlyArray<readonly [kanji: string, kana: string]> = [
  ['帰る', 'かえる'],
  ['入る', 'はいる'],
  ['切る', 'きる'],
  ['走る', 'はしる'],
  ['知る', 'しる'],
  ['要る', 'いる'],
  ['減る', 'へる'],
  ['限る', 'かぎる'],
  ['喋る', 'しゃべる'],
  ['滑る', 'すべる'],
  ['握る', 'にぎる'],
  ['蹴る', 'ける'],
  ['参る', 'まいる'],
  ['焦る', 'あせる'],
  ['練る', 'ねる'],
  ['照る', 'てる'],
  ['散る', 'ちる'],
  ['混じる', 'まじる'],
];

const VERB_ENDINGS = 'うくぐすつぬぶむる';
const I_E_ROWS = 'いきしちにひみりぎじぢびぴえけせてねへめれげぜでべぺ';

/** Ends in an い-row or え-row kana + る: the shape of a group 2 verb. */
export function looksLikeGroup2(kana: string): boolean {
  const [before, last] = chars(kana).slice(-2);
  return last === 'る' && before !== undefined && I_E_ROWS.includes(before);
}

export function isGroup1Exception(word: Pick<Word, 'kanji' | 'kana'>): boolean {
  const { kanji, kana } = word;
  if (kanji === undefined) return false;
  return GROUP1_EXCEPTIONS.some(([k, r]) => kanji.endsWith(k) && kana.endsWith(r));
}

/** する, くる, noun + する, and verbs ending in てくる/でくる, checked on the kana (SPEC §5.5). */
export function isGroup3Form(kana: string): boolean {
  return (
    kana.endsWith('する') || kana === 'くる' || kana.endsWith('てくる') || kana.endsWith('でくる')
  );
}

function checkWord({ value: w, file }: Located<Word>): Problem[] {
  const out: Problem[] = [];
  const error = (code: string, message: string, hint?: string) =>
    out.push({ level: 'error', code, file, id: w.id, message, hint });
  const warn = (code: string, message: string, hint?: string) =>
    out.push({ level: 'warning', code, file, id: w.id, message, hint });

  const badKana = chars(w.kana).filter((c) => !isKanaFieldChar(c));
  if (badKana.length > 0) {
    error(
      'kana-chars',
      `kana "${w.kana}" contains ${badKana.join(' ')}`,
      'kana may contain only hiragana, katakana and ー',
    );
  }

  let kanjiOk = false;
  if (w.kanji !== undefined) {
    const bad = chars(w.kanji).filter((c) => !isKanjiFieldChar(c));
    if (bad.length > 0) {
      error(
        'kanji-chars',
        `kanji "${w.kanji}" contains ${bad.join(' ')}`,
        'kanji may contain only kanji, kana, ー, 々 and ヶ',
      );
    } else if (!hasKanji(w.kanji)) {
      error(
        'kanji-chars',
        `kanji "${w.kanji}" has no kanji`,
        'omit kanji for words written only in kana',
      );
    } else {
      kanjiOk = true;
    }
  }

  if (w.furigana !== undefined && w.kanji === undefined) {
    error('furigana', 'manual furigana on a word without kanji', 'remove furigana or add kanji');
  }
  if (kanjiOk && w.kanji !== undefined && badKana.length === 0) {
    if (w.furigana !== undefined) {
      if (!joinsBack(w.furigana, w.kanji, w.kana)) {
        error(
          'furigana',
          'manual furigana does not join back into kanji and kana',
          'the texts must concatenate to kanji, and the readings (or the text, for kana parts) to kana',
        );
      }
    } else {
      const placed = placeFurigana(w.kanji, w.kana);
      if (!placed.ok && placed.reason === 'no-solution') {
        error(
          'furigana',
          `reading "${w.kana}" does not fit "${w.kanji}"`,
          'the kana in kanji must appear in the reading in the same places; fix kana or add a manual furigana',
        );
      } else if (!placed.ok && placed.reason === 'ambiguous') {
        error(
          'furigana',
          `"${w.kanji}" / "${w.kana}" has more than one furigana placement`,
          'add a manual furigana: [["text","reading"], ...]',
        );
      }
    }
  }

  if (w.pos === 'verb') {
    if (w.verbGroup === undefined) {
      error(
        'verb-group-missing',
        'verb without verbGroup',
        'add verbGroup 1, 2 or 3 from your notes, never from the ending',
      );
    } else {
      const last = chars(w.kana).at(-1) ?? '';
      if (last === '' || !VERB_ENDINGS.includes(last)) {
        error(
          'verb-ending',
          `verb kana "${w.kana}" does not end in う く ぐ す つ ぬ ぶ む る`,
          'use the dictionary form',
        );
      }
      if (w.verbGroup === 2) {
        if (!looksLikeGroup2(w.kana)) {
          error(
            'g2-ending',
            `group 2 verb "${w.kana}" does not end in an い-row or え-row kana + る`,
            'group 2 verbs end in -iru/-eru; check the group in your notes',
          );
        } else if (isGroup1Exception(w)) {
          error(
            'g2-exception',
            `${w.kanji ?? w.kana} is a known group 1 verb that only looks like group 2`,
            'set verbGroup: 1',
          );
        }
      }
      if (w.verbGroup === 3 && !isGroup3Form(w.kana)) {
        error(
          'g3-form',
          `group 3 verb "${w.kana}" is not する, くる, noun + する or ...てくる/でくる`,
          'check the group; 出来る (できる) is group 2',
        );
      }
      if (w.verbGroup === 1 && looksLikeGroup2(w.kana) && !isGroup1Exception(w)) {
        warn(
          'g1-looks-g2',
          `group 1 verb "${w.kanji ?? w.kana}" ends in -iru/-eru and is not on the exceptions list`,
          'looks like group 2, confirm in a dictionary',
        );
      }
      if (kanjiOk && w.kanji !== undefined) {
        const tail = trailingKana(w.kanji);
        if (tail === '' || !w.kana.endsWith(tail)) {
          error(
            'kanji-kana-ending',
            `kanji "${w.kanji}" and kana "${w.kana}" do not end in the same kana`,
            'the okurigana of kanji must be the end of kana',
          );
        }
      }
    }
  } else if (w.verbGroup !== undefined) {
    error('verb-group-forbidden', `verbGroup on a ${w.pos}`, 'only verbs have verbGroup');
  }

  if (!w.meaning.en?.length) warn('meaning-missing', 'no English meaning', 'the app shows Spanish');
  if (!w.meaning.es?.length) warn('meaning-missing', 'no Spanish meaning', 'the app shows English');

  return out;
}

const normalize = (s: string) => s.trim().toLowerCase();

/** Same written form, reading, pos and group, with an identical meaning in either language. */
function isLikelyDuplicate(a: Word, b: Word): boolean {
  if (a.kanji !== b.kanji || a.kana !== b.kana || a.pos !== b.pos || a.verbGroup !== b.verbGroup) {
    return false;
  }
  const overlap = (xs: string[] = [], ys: string[] = []) => {
    const set = new Set(xs.map(normalize));
    return ys.some((y) => set.has(normalize(y)));
  };
  return overlap(a.meaning.en, b.meaning.en) || overlap(a.meaning.es, b.meaning.es);
}

/**
 * Checks words, optionally against an existing set (`against`): a staged file must not reuse
 * or duplicate ids and words that are already live. Problems are reported on `words` only.
 */
export function checkWords(words: Located<Word>[], against: Located<Word>[] = []): Problem[] {
  const problems = words.flatMap(checkWord);

  const seen = new Map<string, string>();
  for (const { value, file } of against) seen.set(value.id, file);
  for (const { value, file } of words) {
    const previous = seen.get(value.id);
    if (previous !== undefined) {
      problems.push({
        level: 'error',
        code: 'dup-id',
        file,
        id: value.id,
        message: `id "${value.id}" is already used in ${previous}`,
        hint: 'ids are unique across all files; add a gloss like kiru-wear',
      });
    } else {
      seen.set(value.id, file);
    }
  }

  words.forEach((word, i) => {
    const earlier = [...against, ...words.slice(0, i)];
    for (const other of earlier) {
      if (other.value.id === word.value.id) continue;
      if (isLikelyDuplicate(word.value, other.value)) {
        problems.push({
          level: 'warning',
          code: 'likely-duplicate',
          file: word.file,
          id: word.value.id,
          message: `looks like a duplicate of "${other.value.id}" (${other.file})`,
          hint: 'same word and meaning; a homophone with a different meaning is fine',
        });
      }
    }
  });

  return problems;
}

export function checkDecks(decks: Located<Deck>[], words: readonly Word[]): Problem[] {
  const problems: Problem[] = [];
  const seen = new Map<string, string>();
  for (const { value: deck, file } of decks) {
    const previous = seen.get(deck.id);
    if (previous !== undefined) {
      problems.push({
        level: 'error',
        code: 'dup-id',
        file,
        id: deck.id,
        message: `deck id "${deck.id}" is already used in ${previous}`,
      });
    }
    seen.set(deck.id, file);
    if (!words.some((w) => matchesDeck(w, deck.match))) {
      problems.push({
        level: 'warning',
        code: 'deck-empty',
        file,
        id: deck.id,
        message: `deck "${deck.id}" matches no words`,
        hint: 'check pos, verbGroup and tags in match',
      });
    }
  }
  return problems;
}
