import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * The service worker (SPEC §4): it keeps the app and its fonts on the device, so the app opens
 * and plays offline. A new version (every deploy, new words included) downloads in the
 * background and waits for *Reload* on the update banner, so it never swaps the app mid-round.
 * Registered once, from main.tsx; the dev server has none.
 */

export interface PwaState {
  /** A new version is ready: Reload switches to it. */
  needRefresh: boolean;
  /** Everything the app needs is on this device. */
  offlineReady: boolean;
}

let state: PwaState = { needRefresh: false, offlineReady: false };
const listeners = new Set<() => void>();

function set(next: Partial<PwaState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

/** A phone keeps the app open for days: back on screen, it looks for a new version now and then. */
const CHECK_EVERY_MS = 10 * 60 * 1000;

export function startPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ needRefresh: true }),
    onOfflineReady: () => set({ offlineReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration === undefined) return;
      let checkedAt = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return;
        if (Date.now() - checkedAt < CHECK_EVERY_MS) return;
        checkedAt = Date.now();
        registration.update().catch(() => {
          // offline or the site unreachable: the next check will do
        });
      });
    },
    onRegisterError: (error: unknown) => console.warn('no service worker', error),
  });
  // a worker that is already active has everything cached (it activates after precaching)
  void navigator.serviceWorker.ready.then(() => set({ offlineReady: true }));
}

/** Switches to the new version: the waiting worker takes over and the page reloads. */
export function reloadToUpdate(): void {
  void updateSW?.(true);
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state);
}
