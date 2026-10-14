import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, type Settings } from './settings.ts';

/** The settings; re-renders when they change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
