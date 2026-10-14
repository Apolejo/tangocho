import { describe, expect, it } from 'vitest';
import type { Word } from '../data/schema.ts';
import { conjugation } from '../games/conjugation/index.ts';
import { kana } from '../games/kana/index.ts';
import { quiz } from '../games/quiz/index.ts';
import { sorter } from '../games/sorter/index.ts';
import { FORMS, type ConjugationForm } from '../lib/conjugate.ts';
import fixtures from '../../data/fixtures/words.json';
import { BUILTIN_DECKS } from '../data/decks.ts';
import { WordsFileSchema } from '../data/schema.ts';
import {
  DEFAULT_SETUP,
  defaultSetup,
  parseSetup,
  setupBlocker,
  setupPool,
  unavailableReason,
} from './setup.ts';

const known = new Set(['all', 'new', 'verbs-g1', 'occupations']);

describe('parseSetup', () => {
  it('reads a stored choice', () => {
    const stored = {
      deckIds: ['verbs-g1', 'occupations'],
      size: 20,
      options: {
        furigana: false,
        direction: 'mixed',
        mode: 'recall',
        inputMode: 'choices',
        forms: ['て', 'た'],
      },
    };
    expect(parseSetup(JSON.stringify(stored), known)).toEqual(stored);
  });

  it('gives a choice saved before the conjugation drill every form and the device’s input mode', () => {
    const stored = {
      deckIds: ['all'],
      size: 10,
      options: { furigana: true, direction: 'forward', mode: 'reading' },
    };
    const onPhone = parseSetup(JSON.stringify(stored), known, defaultSetup('choices'));
    expect(onPhone.options).toEqual({ ...stored.options, inputMode: 'choices', forms: FORMS });
    expect(parseSetup(JSON.stringify(stored), known).options.inputMode).toBe('typing');
  });

  it('keeps forms in the engine’s order, drops unknown ones, and takes every form for none', () => {
    const withForms = (forms: unknown) =>
      parseSetup(JSON.stringify({ deckIds: ['all'], size: 10, options: { forms } }), known).options
        .forms;
    expect(withForms(['た', 'masu', 'ます', 'た'])).toEqual(['ます', 'た']);
    expect(withForms([])).toEqual(FORMS);
    expect(withForms(['gone'])).toEqual(FORMS);
    expect(withForms('て')).toEqual(FORMS);
  });

  it('defaults to typing, with every form', () => {
    expect(DEFAULT_SETUP.options.inputMode).toBe('typing');
    expect(DEFAULT_SETUP.options.forms).toEqual(FORMS);
    expect(defaultSetup('choices').options.inputMode).toBe('choices');
  });

  it('gives a choice saved before kana typing the default mode', () => {
    const stored = {
      deckIds: ['all'],
      size: 10,
      options: { furigana: true, direction: 'forward' },
    };
    expect(parseSetup(JSON.stringify(stored), known).options.mode).toBe('reading');
  });

  it('falls back to the defaults for nothing or garbage', () => {
    expect(parseSetup(null, known)).toEqual(DEFAULT_SETUP);
    expect(parseSetup('{not json', known)).toEqual(DEFAULT_SETUP);
    expect(parseSetup('"text"', known)).toEqual(DEFAULT_SETUP);
  });

  it('drops decks that no longer exist, and repairs bad fields one by one', () => {
    const stored = {
      deckIds: ['gone', 'verbs-g1', 'verbs-g1'],
      size: 15,
      options: {
        furigana: 'yes',
        direction: 'reverse',
        mode: 'writing',
        inputMode: 'voice',
        forms: ['ない'],
      },
    };
    expect(parseSetup(JSON.stringify(stored), known)).toEqual({
      deckIds: ['verbs-g1'],
      size: 10,
      options: {
        furigana: true,
        direction: 'reverse',
        mode: 'reading',
        inputMode: 'typing',
        forms: ['ない'],
      },
    });
    expect(parseSetup(JSON.stringify({ deckIds: ['gone'] }), known).deckIds).toEqual(['all']);
  });
});

describe('unavailableReason', () => {
  const word = (id: string, en: string): Word => ({
    id,
    kana: 'あ',
    pos: 'noun',
    meaning: { en: [en] },
    tags: [],
    added: '2026-10-08',
  });

  it('needs minPool words, then the game’s own check', () => {
    const three = [word('a', 'one'), word('b', 'two'), word('c', 'three')];
    expect(unavailableReason(quiz, three, 'en')).toEqual({ key: 'game_unavailable_pool', n: 4 });
    const sameMeaning = [...three, word('d', 'three')];
    expect(unavailableReason(quiz, sameMeaning, 'en')).toEqual({ key: 'quiz_unavailable' });
    expect(unavailableReason(quiz, [...three, word('d', 'four')], 'en')).toBeUndefined();
  });

  it('turns the sorter off when there is no verb', () => {
    const nouns = [word('a', 'one'), word('b', 'two')];
    expect(unavailableReason(sorter, nouns, 'en')).toEqual({ key: 'sorter_unavailable' });
    const verb: Word = { ...word('c', 'to buy'), kana: 'かう', pos: 'verb', verbGroup: 1 };
    expect(unavailableReason(sorter, [...nouns, verb], 'en')).toBeUndefined();
  });

  it('turns the conjugation drill off when no verb can be conjugated', () => {
    const nouns = [word('a', 'one')];
    expect(unavailableReason(conjugation, nouns, 'en')).toEqual({ key: 'conj_unavailable' });
    // 為る written for する: the engine can't conjugate it
    const odd: Word = {
      ...word('b', 'to do'),
      kanji: '為る',
      kana: 'する',
      pos: 'verb',
      verbGroup: 3,
    };
    expect(unavailableReason(conjugation, [...nouns, odd], 'en')).toEqual({
      key: 'conj_unavailable',
    });
    const verb: Word = { ...word('c', 'to buy'), kana: 'かう', pos: 'verb', verbGroup: 1 };
    expect(unavailableReason(conjugation, [...nouns, verb], 'en')).toBeUndefined();
  });

  it('runs kana typing on any word, and on none turns it off', () => {
    expect(unavailableReason(kana, [], 'en')).toEqual({ key: 'kana_unavailable' });
    expect(unavailableReason(kana, [word('a', 'one')], 'en')).toBeUndefined();
  });
});

describe('the conjugation drill’s personal-best variant', () => {
  it('is the input mode and the forms, in the engine’s order', () => {
    const variant = (inputMode: 'typing' | 'choices', forms: readonly ConjugationForm[]) =>
      conjugation.variant({ ...DEFAULT_SETUP.options, inputMode, forms });
    expect(variant('typing', FORMS)).toBe(
      'typing|辞書形+ます+ません+ました+ませんでした+て+ない+た',
    );
    expect(variant('choices', ['た', 'て'])).toBe('choices|て+た');
  });
});

describe('setupBlocker', () => {
  const all = WordsFileSchema.parse(fixtures);
  // years after the fixtures were added, so the "new this week" deck is empty
  const now = new Date(2030, 0, 1, 12);
  const blocker = (game: typeof quiz, choice = DEFAULT_SETUP, words: readonly Word[] = all) =>
    setupBlocker(game, choice, setupPool(game, choice, BUILTIN_DECKS, words, now), words, 'en');

  it('lets a round start with decks, words and forms', () => {
    expect(blocker(quiz)).toBeUndefined();
    expect(blocker(conjugation)).toBeUndefined();
  });

  it('names what stops it: the game, no decks, no words, no forms', () => {
    expect(blocker(quiz, DEFAULT_SETUP, all.slice(0, 2))).toEqual({
      key: 'game_unavailable_pool',
      n: 4,
    });
    expect(blocker(quiz, { ...DEFAULT_SETUP, deckIds: [] })).toEqual({ key: 'setup_decks_none' });
    expect(blocker(quiz, { ...DEFAULT_SETUP, deckIds: ['new'] })).toEqual({
      key: 'setup_pool_empty',
    });
    expect(
      blocker(conjugation, { ...DEFAULT_SETUP, options: { ...DEFAULT_SETUP.options, forms: [] } }),
    ).toEqual({ key: 'setup_forms_none' });
  });
});
