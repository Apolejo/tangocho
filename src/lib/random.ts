/**
 * Randomness with an injectable source: rounds are shuffled in play and deterministic in tests.
 * Pure apart from Web Crypto, which browsers and Node both provide.
 */

/** A source of numbers in [0, 1), like Math.random. */
export type Rng = () => number;

/** A small seeded generator (mulberry32): the same seed always gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random 32-bit seed. */
export function randomSeed(): number {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  return seed;
}

/** A 32-bit seed drawn from another generator. */
export function nextSeed(rng: Rng): number {
  return Math.floor(rng() * 0x1_0000_0000) >>> 0;
}

/** Fisher–Yates: a shuffled copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** A random element; undefined for an empty list. */
export function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  return items[Math.floor(rng() * items.length)];
}

/**
 * A random UUID v4. Built from getRandomValues because crypto.randomUUID needs a secure context,
 * and the phone reaches the dev server over plain http on the LAN.
 */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
