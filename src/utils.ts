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

/** An entity's position this tick plus where it was on the previous one. */
export interface Swept {
  _x: number;
  _y: number;
  lastX: number;
  lastY: number;
}

/**
 * Closest the two entities came to each other *at any point during the tick*, rather than only
 * where they happened to land at the end of it. A tick is ~80ms and a boosting pod or a lunging
 * shark can cover several world units in that time, so sampling endpoints alone lets them swap
 * sides without ever registering a hit - you see the sprites pass straight through each other.
 * Treats both as moving in a straight line over the tick and minimises the distance between
 * them, which is exact for constant velocity and close enough for the eased curves we use.
 */
export function sweptDistance(a: Swept, b: Swept): number {
  // Relative offset at the start of the tick, and how that offset changes across it.
  const ox = directionDelta(a.lastX, b.lastX);
  const oy = a.lastY - b.lastY;
  const vx = directionDelta(a._x, a.lastX) - directionDelta(b._x, b.lastX);
  const vy = a._y - a.lastY - (b._y - b.lastY);
  const vv = vx * vx + vy * vy;
  // Closest approach along the tick, clamped to the tick itself so we never report a miss that
  // only happens before or after it.
  const t = vv < 1e-9 ? 0 : Math.max(0, Math.min(1, -(ox * vx + oy * vy) / vv));
  return Math.hypot(ox + vx * t, oy + vy * t);
}
