import type { Word } from '../data/schema.ts';

/**
 * The conjugation engine (SPEC §11): derives a verb's forms from its dictionary form, its reading
 * and its stored group. Conjugations are never stored; everything that shows one calls this.
 */

/** The forms in v1. Answer events store these ids (SPEC §10.1): never rename one. */
export const FORMS = [
  '辞書形',
  'ます',
  'ません',
  'ました',
  'ませんでした',
  'て',
  'ない',
  'た',
] as const;
export type ConjugationForm = (typeof FORMS)[number];

export function isForm(value: string | undefined): value is ConjugationForm {
  return FORMS.some((form) => form === value);
}

export interface Conjugated {
  kanji?: string;
  kana: string;
}

type Verb = Pick<Word, 'kanji' | 'kana' | 'verbGroup'>;

/**
 * How a verb conjugates: the kana it drops from the end of its dictionary form, and what each
 * form puts in their place. ます forms add the form id to `masu` (書き + ません); ない adds ない
 * to `nai`; た is `te` with て → た, で → だ.
 */
interface Paradigm {
  drop: string;
  masu: string;
  nai: string;
  te: string;
}

/** Group 1, by final kana: the い-row partner (ます), the あ-row partner (ない) and the て form. */
const GROUP1: Readonly<Record<string, Omit<Paradigm, 'drop'>>> = {
  う: { masu: 'い', nai: 'わ', te: 'って' },
  く: { masu: 'き', nai: 'か', te: 'いて' },
  ぐ: { masu: 'ぎ', nai: 'が', te: 'いで' },
  す: { masu: 'し', nai: 'さ', te: 'して' },
  つ: { masu: 'ち', nai: 'た', te: 'って' },
  ぬ: { masu: 'に', nai: 'な', te: 'んで' },
  ぶ: { masu: 'び', nai: 'ば', te: 'んで' },
  む: { masu: 'み', nai: 'ま', te: 'んで' },
  る: { masu: 'り', nai: 'ら', te: 'って' },
};

const GROUP2: Paradigm = { drop: 'る', masu: '', nai: '', te: 'て' };
const SURU: Paradigm = { drop: 'する', masu: 'し', nai: 'し', te: 'して' };
const KURU: Paradigm = { drop: 'くる', masu: 'き', nai: 'こ', te: 'きて' };

/** 行く and verbs ending in ていく/でいく (持っていく) take って/った, not いて/いた. */
const isIku = (kana: string) =>
  kana === 'いく' || kana.endsWith('ていく') || kana.endsWith('でいく');

/** くる alone or at the end of a compound: 持ってくる, 迎えにくる (SPEC §5.5, group 3). */
const isKuru = (kana: string) =>
  kana === 'くる' || kana.endsWith('てくる') || kana.endsWith('でくる') || kana.endsWith('にくる');

function paradigm({ kana, verbGroup }: Verb): Paradigm | undefined {
  switch (verbGroup) {
    case 1: {
      const last = kana.at(-1) ?? '';
      const rule = GROUP1[last];
      if (rule === undefined || kana.length < 2) return undefined;
      return { drop: last, ...rule, te: isIku(kana) ? 'って' : rule.te };
    }
    case 2:
      return kana.length >= 2 && kana.endsWith('る') ? GROUP2 : undefined;
    case 3:
      if (kana.endsWith('する')) return SURU;
      if (isKuru(kana)) return KURU;
      return undefined;
    default:
      return undefined;
  }
}

/** What replaces the dropped kana in a form. */
function ending(p: Paradigm, form: ConjugationForm): string {
  switch (form) {
    case '辞書形':
      return p.drop;
    case 'ます':
    case 'ません':
    case 'ました':
    case 'ませんでした':
      return p.masu + form;
    case 'ない':
      return `${p.nai}ない`;
    case 'て':
      return p.te;
    case 'た':
      return p.te.replace(/て$/, 'た').replace(/で$/, 'だ');
  }
}

const replaceEnd = (text: string, drop: string, add: string) => text.slice(0, -drop.length) + add;

/**
 * The written form keeps whatever kanji precede the ending. 来 stays when its reading changes:
 * 来る → 来ない (こない), so the kanji stands for the first kana of the ending.
 */
function writtenForm(kanji: string, p: Paradigm, end: string): string | undefined {
  if (kanji.endsWith(p.drop)) return replaceEnd(kanji, p.drop, end);
  if (p === KURU && kanji.endsWith('来る')) return replaceEnd(kanji, '来る', `来${end.slice(1)}`);
  return undefined;
}

/**
 * A verb in one form, written and read. undefined when the verb doesn't fit its group, or its
 * written form and reading end differently (the validator reports both, SPEC §5.5).
 */
export function conjugate(word: Verb, form: ConjugationForm): Conjugated | undefined {
  const p = paradigm(word);
  if (p === undefined) return undefined;
  const end = ending(p, form);
  const kanji = word.kanji === undefined ? undefined : writtenForm(word.kanji, p, end);
  if (word.kanji !== undefined && kanji === undefined) return undefined;
  // ある has no ない form of its own: its negative is the word ない.
  if (word.verbGroup === 1 && word.kana === 'ある' && form === 'ない') return { kana: 'ない' };
  const kana = replaceEnd(word.kana, p.drop, end);
  return kanji === undefined ? { kana } : { kanji, kana };
}
