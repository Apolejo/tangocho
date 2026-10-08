import type { Word } from '../data/schema.ts';
import { chars, isKanjiRunChar } from './jp.ts';

/** One ruby group: `[text, reading]`; reading is '' for kana that needs no ruby (SPEC §5.1 `furigana`). */
export type FuriganaPair = [text: string, reading: string];

export type Placement =
  | { ok: true; pairs: FuriganaPair[] }
  | { ok: false; reason: 'no-kanji' | 'no-solution' | 'ambiguous' };

interface Run {
  text: string;
  kanji: boolean;
}

/** Splits a written form into alternating kanji runs (kanji, 々, ヶ) and kana runs. */
export function splitRuns(written: string): Run[] {
  const runs: Run[] = [];
  for (const ch of chars(written)) {
    const kanji = isKanjiRunChar(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ text: ch, kanji });
  }
  return runs;
}

/**
 * Places furigana (SPEC §5.4): kana in the written form are fixed anchors and each kanji run
 * takes the part of the reading between them (at least one kana). Enumerates solutions and
 * reports when there is none or more than one.
 */
export function placeFurigana(written: string, reading: string): Placement {
  const runs = splitRuns(written);
  if (!runs.some((r) => r.kanji)) return { ok: false, reason: 'no-kanji' };
  const read = chars(reading);
  const solutions: FuriganaPair[][] = [];

  const solve = (runIndex: number, pos: number, acc: FuriganaPair[]): void => {
    if (solutions.length >= 2) return;
    const run = runs[runIndex];
    if (run === undefined) {
      if (pos === read.length) solutions.push(acc);
      return;
    }
    if (!run.kanji) {
      const anchor = chars(run.text);
      for (let k = 0; k < anchor.length; k++) if (read[pos + k] !== anchor[k]) return;
      solve(runIndex + 1, pos + anchor.length, [...acc, [run.text, '']]);
      return;
    }
    for (let len = 1; pos + len <= read.length; len++) {
      solve(runIndex + 1, pos + len, [...acc, [run.text, read.slice(pos, pos + len).join('')]]);
      if (solutions.length >= 2) return;
    }
  };
  solve(0, 0, []);

  const first = solutions[0];
  if (first === undefined) return { ok: false, reason: 'no-solution' };
  if (solutions.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, pairs: first };
}

/** True when the pairs concatenate back to the written form and to the reading. */
export function joinsBack(pairs: FuriganaPair[], written: string, reading: string): boolean {
  const texts = pairs.map(([text]) => text).join('');
  const readings = pairs.map(([text, r]) => (r === '' ? text : r)).join('');
  return texts === written && readings === reading;
}

/**
 * What the UI renders: the manual override, else automatic placement, else the whole word as
 * one ruby group. Never throws; the validator is where bad data gets reported.
 */
export function furiganaFor(word: Pick<Word, 'kanji' | 'kana' | 'furigana'>): FuriganaPair[] {
  if (word.kanji === undefined) return [[word.kana, '']];
  if (word.furigana !== undefined) return word.furigana;
  const placed = placeFurigana(word.kanji, word.kana);
  return placed.ok ? placed.pairs : [[word.kanji, word.kana]];
}
