import { SIZE_X, SIZE_Y } from './constants';

/** Wraps an x coordinate around the horizontal edges of the world. */
export function wrapX(x: number): number {
  return ((x % SIZE_X) + SIZE_X) % SIZE_X;
}

/** Clamps an x coordinate to the world bounds without wrapping. */
export function clampX(x: number): number {
  return Math.max(0, Math.min(SIZE_X, x));
}

/** Clamps a y coordinate to the world bounds, keeping `margin` clear at each edge. */
export function clampEntityY(y: number, margin: number): number {
  return Math.min(SIZE_Y - 1 - margin, Math.max(margin, y));
}

/** Shortest signed distance from `last` to `current` along a wrapping horizontal axis. */
export function directionDelta(current: number, last: number): number {
  let d = current - last;
  if (d > SIZE_X / 2) d -= SIZE_X;
  if (d < -SIZE_X / 2) d += SIZE_X;
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

/**
 * A "tap this several times quickly" gesture, for the testing shortcuts.
 *
 * Shared rather than written out at each site so the two cheats cannot drift into needing
 * different numbers of taps or different patience, and so the counter resets the same way: a gap
 * longer than `gapMs` starts again, which is what stops idle prodding ever reaching the count.
 */
export function secretTapGesture(
  taps: number,
  gapMs: number,
  onFire: () => void,
  onProgress?: (count: number, needed: number) => void,
): () => void {
  let count = 0;
  let lastAt = 0;
  return () => {
    const now = Date.now();
    count = now - lastAt > gapMs ? 1 : count + 1;
    lastAt = now;
    if (count < taps) {
      // Something visible from partway in. A gesture that stays silent until it fires is
      // indistinguishable from one that is not registering, which is exactly how it reads when
      // a tap lands slightly wide or a beat too slow.
      onProgress?.(count, taps);
      return;
    }
    count = 0;
    onFire();
  };
}

/**
 * Binds a tap gesture to an element in a way a thumb can actually drive.
 *
 * pointerdown rather than click: on touch, a click on a non-interactive element can be held back
 * or dropped entirely, and rapid taps on text start a selection whose magnifier eats the rest of
 * them. The two CSS properties are the other half of that - without them the browser is trying
 * to select words while the gesture is trying to count taps.
 */
export function bindSecretTaps(el: HTMLElement, handler: () => void): void {
  el.style.userSelect = 'none';
  el.style.webkitUserSelect = 'none';
  el.style.touchAction = 'manipulation';
  el.style.cursor = 'default';
  el.addEventListener('pointerdown', handler);
}

/**
 * How to draw a sprite so it faces the way it is travelling, for artwork drawn facing +x.
 *
 * `dir` is the horizontal scale sign: -1 mirrors the sprite for anything heading left. `rotation`
 * then aims it. The mirrored case is the subtle one - Pixi scales before it rotates, so after the
 * flip the nose points along -x and the angle that aims it at (tx, ty) is atan2(-ty, -tx), the
 * *opposite* heading. Measuring against a half-mirrored axis instead - atan2(ty, -tx) - flips the
 * horizontal component and leaves the vertical one, which draws anything moving up-and-left as
 * though it were moving down-and-left.
 */
export function spriteFacing(tx: number, ty: number): { dir: 1 | -1; rotation: number } {
  const dir: 1 | -1 = tx >= 0 ? 1 : -1;
  return { dir, rotation: dir === 1 ? Math.atan2(ty, tx) : Math.atan2(-ty, -tx) };
}
