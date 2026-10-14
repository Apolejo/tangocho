/**
 * The theme (SPEC §13): the night notebook follows the system unless Settings chose light or
 * dark. The choice has its own key, like the language, so resetting progress keeps it.
 * index.html applies the stored choice before the first paint, repeating the key and the paper
 * colors; theme.test.ts checks that they match.
 */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'tangocho:theme';

/** `--paper` of each scheme in tokens.css, for the browser's theme-color. */
export const PAPER = { light: '#f6f1e7', dark: '#171c27' } as const;

export function parseTheme(raw: string | null | undefined): Theme {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * Sets `<html data-theme>` (tokens.css turns it into `color-scheme`) and the two theme-color
 * metas, whose media queries pick one by the system scheme.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = PAPER[theme === 'system' ? scheme : theme];
  }
}

let current: Theme | undefined;
const listeners = new Set<() => void>();

/** The theme, read once from localStorage. */
export function getTheme(): Theme {
  if (current === undefined) {
    try {
      current = parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      current = 'system';
    }
  }
  return current;
}

/** Changes the theme, applies it and saves it; storage that fails keeps it for this visit. */
export function setTheme(theme: Theme): void {
  current = theme;
  applyTheme(theme);
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage disabled: the theme lasts for this visit only
  }
  for (const listener of listeners) listener();
}

export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
