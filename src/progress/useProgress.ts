import { useSyncExternalStore } from 'react';
import { progress, type ProgressSnapshot } from './store.ts';

/** The progress log and its derived state; re-renders as answers come in. */
export function useProgress(): ProgressSnapshot {
  return useSyncExternalStore(progress.subscribe, progress.getSnapshot);
}
