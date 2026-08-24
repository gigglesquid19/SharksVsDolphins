import { SIZE } from './constants';

/** Wraps an x coordinate around the horizontal edges of the world. */
export function wrapX(x: number): number {
  return ((x % SIZE) + SIZE) % SIZE;
}

/** Clamps an x coordinate to the world bounds without wrapping. */
export function clampX(x: number): number {
  return Math.max(0, Math.min(SIZE, x));
}

/** Clamps a y coordinate to the world bounds, keeping `margin` clear at each edge. */
export function clampEntityY(y: number, margin: number): number {
  return Math.min(SIZE - 1 - margin, Math.max(margin, y));
}

/** Shortest signed distance from `last` to `current` along a wrapping horizontal axis. */
export function directionDelta(current: number, last: number): number {
  let d = current - last;
  if (d > SIZE / 2) d -= SIZE;
  if (d < -SIZE / 2) d += SIZE;
  return d;
}
