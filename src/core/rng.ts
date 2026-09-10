/**
 * Deterministic randomness. Every piece of scattered world detail is derived
 * from a seed so that the world looks identical on every load — and so that a
 * saved game can reproduce it without storing thousands of decorations.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for decoration and particles. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of two integer coordinates plus a salt, returned as 0..1. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function randRange(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

export function randInt(rng: Rng, lo: number, hi: number): number {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Smooth 2D value noise, 0..1. Used for terrain tinting and cloud shadows. */
export function noise2(x: number, y: number, salt = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, salt);
  const b = hash2(xi + 1, yi, salt);
  const c = hash2(xi, yi + 1, salt);
  const d = hash2(xi + 1, yi + 1, salt);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
