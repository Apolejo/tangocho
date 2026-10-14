import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, type Theme } from './theme.ts';

/** The theme choice; re-renders when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme);
}
