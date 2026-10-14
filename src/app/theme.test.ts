import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import tokens from '../styles/tokens.css?raw';
import { PAPER, THEME_STORAGE_KEY, parseTheme } from './theme.ts';

describe('parseTheme', () => {
  it('keeps light and dark', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
  });

  it('falls back to the system for anything else', () => {
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
    expect(parseTheme('system')).toBe('system');
    expect(parseTheme('Dark')).toBe('system');
    expect(parseTheme('')).toBe('system');
  });
});

describe('the copies of the theme outside theme.ts', () => {
  it('PAPER matches --paper in tokens.css', () => {
    const paper = /--paper:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(tokens);
    expect(paper?.slice(1, 3)).toEqual([PAPER.light, PAPER.dark]);
  });

  it('index.html reads the same key and sets the same colors before the first paint', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    expect(html).toContain(`theme === 'dark' ? '${PAPER.dark}' : '${PAPER.light}'`);
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${PAPER.light}" />`,
    );
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${PAPER.dark}" />`,
    );
  });
});
