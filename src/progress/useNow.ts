import { useSyncExternalStore } from 'react';

/**
 * The current time for screens that count due cards and days: it moves on every minute and when
 * the app comes back to the foreground, so a phone left open past 04:00 or past a learning step
 * shows the right counts. Render stays pure: the time is read from here, never from new Date().
 */

const TICK_MS = 60_000;

let now = new Date();
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick(): void {
  now = new Date();
  for (const listener of listeners) listener();
}

function onVisible(): void {
  if (document.visibilityState === 'visible') tick();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    // the first screen to look gets a fresh time; React re-renders when it differs
    now = new Date();
    timer = window.setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

const getNow = () => now;

export function useNow(): Date {
  return useSyncExternalStore(subscribe, getNow);
}
