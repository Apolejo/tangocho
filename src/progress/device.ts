import { newId } from '../lib/random.ts';

/** A random id for this install, written into every answer event (SPEC §10.1). */

const DEVICE_KEY = 'tangocho:device';

let cached: string | undefined;

export function deviceId(): string {
  if (cached !== undefined) return cached;
  try {
    cached = localStorage.getItem(DEVICE_KEY) ?? undefined;
    if (cached === undefined) {
      cached = newId();
      localStorage.setItem(DEVICE_KEY, cached);
    }
  } catch {
    // storage disabled: an id for this visit only
    cached ??= newId();
  }
  return cached;
}
