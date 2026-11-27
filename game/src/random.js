// A tiny seeded random source, so the same seed always builds the same valley, the
// same rings and the same weather — and the same seed always gives the same screenshots.

/** Mulberry32: a small fast generator with a 32-bit seed. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 hash of two integers: the valley's fields, trees and houses are placed
 *  by hashing their (lane, slice) coordinates, so no placement table is ever stored. */
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A smooth 0..1 noise of one variable, built from hashed control points. */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(i, 7);
  const b = hash2(i + 1, 7);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Clamp a value into a range. */
export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** Move a value toward a target by at most `maxStep`. */
export function approach(value, target, maxStep) {
  if (value < target) return Math.min(target, value + maxStep);
  if (value > target) return Math.max(target, value - maxStep);
  return value;
}
