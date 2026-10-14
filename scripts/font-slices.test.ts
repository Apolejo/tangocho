import { describe, expect, it } from 'vitest';
import {
  codePointsOf,
  covers,
  fontFaceRanges,
  parseUnicodeRange,
  selectFontSlices,
} from './font-slices.ts';

describe('parseUnicodeRange', () => {
  it('reads single points, ranges and wildcards, in any case', () => {
    expect(parseUnicodeRange('U+0-FF, u+131,U+4??')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
    expect(parseUnicodeRange('U+6728-672a')).toEqual([[0x6728, 0x672a]]);
  });
});

describe('fontFaceRanges', () => {
  // as Lightning CSS writes Fontsource's faces in the build
  const css = [
    '@font-face{font-family:Klee One;src:url(/tangocho/assets/klee-one-0-400-normal-AbC123.woff2)format("woff2"),url(/tangocho/assets/klee-one-0-400-normal-XyZ.woff)format("woff");unicode-range:U+7D5E,U+6728-672A}',
    '@font-face{font-family:Klee One;src:url(data:font/woff2;base64,AAAA)format("woff2");unicode-range:U+FF5E}',
    '@font-face{font-family:Klee One;src:url("/tangocho/assets/klee-one-latin-400-normal-Q1.woff2")format("woff2")}',
  ].join('');

  it('maps each woff2 file to its ranges, skipping inlined faces and .woff fallbacks', () => {
    const faces = fontFaceRanges(css);
    expect([...faces.keys()]).toEqual([
      'klee-one-0-400-normal-AbC123.woff2',
      'klee-one-latin-400-normal-Q1.woff2',
    ]);
    expect(faces.get('klee-one-0-400-normal-AbC123.woff2')).toEqual([
      [0x7d5e, 0x7d5e],
      [0x6728, 0x672a],
    ]);
  });

  it('treats a face without a unicode-range as covering everything', () => {
    expect(fontFaceRanges(css).get('klee-one-latin-400-normal-Q1.woff2')).toEqual([[0, 0x10ffff]]);
  });
});

describe('covers', () => {
  it('is true when a character of the app falls in a range', () => {
    expect(covers([[0x6728, 0x672a]], codePointsOf(['本と木']))).toBe(true);
    expect(covers([[0x6728, 0x672a]], codePointsOf(['本']))).toBe(false);
  });

  it('always keeps kana, ASCII and fullwidth forms', () => {
    expect(covers([[0x30a0, 0x30ff]], new Set())).toBe(true); // katakana
    expect(covers([[0x41, 0x41]], new Set())).toBe(true);
    expect(covers([[0xff01, 0xff01]], new Set())).toBe(true);
    expect(covers([[0x4e00, 0x4e00]], new Set())).toBe(false);
  });
});

describe('selectFontSlices', () => {
  it('keeps what the app shows, drops the rest of Japanese, and keeps anything unknown', () => {
    const faces = new Map([
      ['a.woff2', [[0x6728, 0x672a] as const]],
      ['b.woff2', [[0x4e00, 0x4e00] as const]],
    ]);
    const entries = [
      { url: 'assets/a.woff2' },
      { url: 'assets/b.woff2' },
      { url: 'assets/c.woff2' },
      { url: 'index.html' },
    ];
    const { kept, dropped } = selectFontSlices(entries, faces, codePointsOf(['木']));
    expect(kept.map((e) => e.url)).toEqual(['assets/a.woff2', 'assets/c.woff2', 'index.html']);
    expect(dropped.map((e) => e.url)).toEqual(['assets/b.woff2']);
  });
});
