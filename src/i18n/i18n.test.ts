import { describe, expect, it } from 'vitest';
import { en } from './en.ts';
import { es } from './es.ts';
import { detectLang, format, initialLang, translate } from './lang.ts';
import type { Word } from '../data/schema.ts';
import { meaningText, pickLocalized } from './localized.ts';

describe('messages', () => {
  it('es defines exactly the keys of en', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('every message has a non-empty string', () => {
    for (const messages of [en, es]) {
      for (const value of Object.values(messages)) expect(value.trim()).not.toBe('');
    }
  });
});

describe('detectLang / initialLang', () => {
  it('maps es* to Spanish and everything else to English', () => {
    expect(detectLang('es-MX')).toBe('es');
    expect(detectLang('ES')).toBe('es');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('ja')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });

  it('prefers a remembered valid choice', () => {
    expect(initialLang('es', 'en-US')).toBe('es');
    expect(initialLang('fr', 'es-ES')).toBe('es');
    expect(initialLang(null, 'en-GB')).toBe('en');
  });
});

describe('format / translate', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(format('{n} words', { n: 3 })).toBe('3 words');
    expect(format('Group {n} of {m}', { n: 1 })).toBe('Group 1 of {m}');
    expect(format('plain')).toBe('plain');
  });

  it('translates in both languages', () => {
    expect(translate('en', 'notebook_count_other', { n: 2 })).toBe('2 words');
    expect(translate('es', 'notebook_count_other', { n: 2 })).toBe('2 palabras');
  });
});

describe('pickLocalized', () => {
  it('picks the current language, then the other', () => {
    expect(pickLocalized({ en: ['a'], es: ['b'] }, 'es')).toEqual({ lang: 'es', value: ['b'] });
    expect(pickLocalized({ en: ['a'] }, 'es')).toEqual({ lang: 'en', value: ['a'] });
    expect(pickLocalized({}, 'en')).toBeUndefined();
  });
});

describe('meaningText', () => {
  it('joins every gloss and falls back to the other language', () => {
    const w: Word = {
      id: 'miru',
      kana: 'みる',
      pos: 'verb',
      verbGroup: 2,
      meaning: { en: ['to see', 'to watch'], es: [] },
      tags: [],
      added: '2026-10-08',
    };
    expect(meaningText(w, 'en')).toEqual({ lang: 'en', text: 'to see, to watch' });
    expect(meaningText(w, 'es')).toEqual({ lang: 'en', text: 'to see, to watch' });
  });
});
