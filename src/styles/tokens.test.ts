import { describe, expect, it } from 'vitest';
import tokens from './tokens.css?raw';

/**
 * Contrast of the design tokens (SPEC §13): text meets WCAG AA (4.5:1) and a control's edge or
 * focus ring 3:1, in the paper notebook and the night notebook. Reads tokens.css itself, takes
 * each half of light-dark() and works out color-mix(), so a changed token is checked as written.
 */

type Scheme = 0 | 1; // light, dark
type Rgba = [number, number, number, number];

const declarations = new Map(
  [...tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
    name ?? '',
    (value ?? '').replace(/\/\*.*?\*\//g, '').trim(),
  ]),
);

/** The text inside the parentheses that open at `start`, and the index after them. */
function group(text: string, start: number): [string, number] {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return [text.slice(start + 1, i), i + 1];
  }
  throw new Error(`unbalanced: ${text}`);
}

/** Splits on the commas that aren't inside parentheses. */
function args(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  return [...parts, text.slice(from).trim()];
}

function color(value: string, scheme: Scheme): Rgba {
  const v = value.trim();
  if (v === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{6})$/i.exec(v)?.[1];
  if (hex !== undefined) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1) as Rgba;
  }
  const rgba = /^rgba\(([^)]+)\)$/.exec(v)?.[1];
  if (rgba !== undefined) return rgba.split(',').map(Number) as Rgba;
  const fn = /^([\w-]+)\(/.exec(v)?.[1];
  if (fn === undefined) throw new Error(`not a color: ${v}`);
  const [inner] = group(v, fn.length);
  const parts = args(inner);
  switch (fn) {
    case 'var': {
      const value = declarations.get(parts[0] ?? '');
      if (value === undefined) throw new Error(`no token ${parts[0]}`);
      return color(value, scheme);
    }
    case 'light-dark':
      return color(parts[scheme] ?? '', scheme);
    case 'color-mix': {
      // color-mix(in srgb, A p%, B): p% of A, the rest of B, premultiplied by alpha
      const [space, first, second] = parts;
      expect(space).toBe('in srgb');
      const m = /^(.*\S)\s+([\d.]+)%$/.exec(first ?? '');
      if (m === null || second === undefined) throw new Error(`unsupported: ${v}`);
      const p = Number(m[2]) / 100;
      const a = color(m[1] ?? '', scheme);
      const b = color(second, scheme);
      const alpha = a[3] * p + b[3] * (1 - p);
      const channel = (i: number) =>
        alpha === 0 ? 0 : (a[i]! * a[3] * p + b[i]! * b[3] * (1 - p)) / alpha;
      return [channel(0), channel(1), channel(2), alpha];
    }
    default:
      throw new Error(`unsupported: ${v}`);
  }
}

const token = (name: string, scheme: Scheme) => color(`var(${name})`, scheme);

/** A translucent color laid over an opaque one. */
const over = (top: Rgba, below: Rgba): Rgba => [
  ...([0, 1, 2].map((i) => top[i]! * top[3] + below[i]! * (1 - top[3])) as [
    number,
    number,
    number,
  ]),
  1,
];

const luminance = ([r, g, b]: Rgba) => {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([
  ['the paper notebook', 0],
  ['the night notebook', 1],
] as const)('%s', (_, scheme) => {
  const paper = token('--paper', scheme);
  const card = token('--card', scheme);
  const washi = over(token('--washi', scheme), paper); // the banners and washi-tape strips
  const grounds = { paper, card, washi } as const;

  it.each(['--ink', '--ink-soft', '--ai', '--shu'])('%s text is AA on paper and card', (name) => {
    for (const ground of [paper, card]) {
      expect(contrast(token(name, scheme), ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['--ink', '--ai'])('%s text is AA on washi tape', (name) => {
    expect(contrast(token(name, scheme), grounds.washi)).toBeGreaterThanOrEqual(4.5);
  });

  it('the paper-colored text on an indigo button is AA', () => {
    expect(contrast(paper, token('--ai', scheme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['--edge', 'a text field, on the question card', ['paper', 'card']],
    ['--ai', 'the focus ring', ['paper', 'card', 'washi']],
    ['--ink-soft', 'an icon, like the banners’ ✕', ['paper', 'card', 'washi']],
    ['--shu', 'the ◯ stamp', ['paper', 'card']],
  ] as const)('%s, %s, is 3:1 against what it sits on', (name, _, on) => {
    for (const ground of on) {
      expect(contrast(token(name, scheme), grounds[ground])).toBeGreaterThanOrEqual(3);
    }
  });
});
