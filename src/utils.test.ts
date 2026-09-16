import { describe, expect, it } from 'vitest';
import { SIZE_X, SIZE_Y } from './constants';
import { clampEntityY, clampX, directionDelta, spriteFacing, sweptDistance, wrapX } from './utils';

describe('wrapX', () => {
  it('leaves in-bounds values unchanged', () => {
    expect(wrapX(0)).toBe(0);
    expect(wrapX(50)).toBe(50);
  });

  it('wraps values past the right edge', () => {
    expect(wrapX(SIZE_X + 50)).toBe(50);
    expect(wrapX(SIZE_X)).toBe(0);
  });

  it('wraps negative values from the left edge', () => {
    expect(wrapX(-10)).toBe(SIZE_X - 10);
  });
});

describe('clampX', () => {
  it('leaves in-bounds values unchanged', () => {
    expect(clampX(50)).toBe(50);
  });

  it('clamps above the upper bound', () => {
    expect(clampX(SIZE_X + 50)).toBe(SIZE_X);
  });

  it('clamps below the lower bound', () => {
    expect(clampX(-10)).toBe(0);
  });
});

describe('clampEntityY', () => {
  it('leaves values within the margin unchanged', () => {
    expect(clampEntityY(50, 2)).toBe(50);
  });

  it('clamps above the upper margin', () => {
    expect(clampEntityY(SIZE_Y + 30, 2)).toBe(SIZE_Y - 3);
  });

  it('clamps below the lower margin', () => {
    expect(clampEntityY(-10, 2)).toBe(2);
  });
});

describe('directionDelta', () => {
  it('returns the direct delta when there is no wrap-around', () => {
    expect(directionDelta(60, 40)).toBe(20);
    expect(directionDelta(40, 60)).toBe(-20);
  });

  it('takes the shorter wrapped path across the right edge', () => {
    expect(directionDelta(10, SIZE_X - 10)).toBe(20);
  });

  it('takes the shorter wrapped path across the left edge', () => {
    expect(directionDelta(SIZE_X - 10, 10)).toBe(-20);
  });
});

describe('sweptDistance', () => {
  const at = (lastX: number, lastY: number, x: number, y: number) => ({ lastX, lastY, _x: x, _y: y });

  it('matches the plain distance when neither entity moved', () => {
    expect(sweptDistance(at(50, 50, 50, 50), at(53, 54, 53, 54))).toBeCloseTo(5);
  });

  it('catches a pass-through that the end-of-tick positions miss', () => {
    // A dolphin sweeping left to right straight through a stationary shark. Both endpoints are
    // 6 units away - a hit radius of 5 would see nothing - but they overlap mid-tick.
    const dolphin = at(44, 50, 56, 50);
    const shark = at(50, 50, 50, 50);
    expect(Math.hypot(dolphin._x - shark._x, dolphin._y - shark._y)).toBe(6);
    expect(sweptDistance(shark, dolphin)).toBeCloseTo(0);
  });

  it('reports the true gap for two entities crossing without touching', () => {
    // Same sweep, but three units below: the closest they ever come is that three units.
    expect(sweptDistance(at(50, 50, 50, 50), at(44, 53, 56, 53))).toBeCloseTo(3);
  });

  it('does not report a hit that only happens after the tick ends', () => {
    // Both moving right, the shark trailing and gaining: they will meet, but not during the
    // tick, so the closest approach within it is the end-of-tick gap.
    expect(sweptDistance(at(40, 50, 44, 50), at(50, 50, 52, 50))).toBeCloseTo(8);
  });

  it('measures across the horizontal seam rather than around the world', () => {
    // Shark stepping off the right edge onto the left one, dolphin waiting just inside it.
    expect(sweptDistance(at(SIZE_X - 1, 50, 1, 50), at(2, 50, 2, 50))).toBeCloseTo(1);
  });

  it('is symmetric in its arguments', () => {
    const a = at(44, 50, 56, 51);
    const b = at(50, 47, 50, 55);
    expect(sweptDistance(a, b)).toBeCloseTo(sweptDistance(b, a));
  });
});

describe('spriteFacing', () => {
  /** Where a sprite drawn facing +x actually ends up pointing, once mirrored and rotated. */
  function aimedAt(tx: number, ty: number): { x: number; y: number } {
    const { dir, rotation } = spriteFacing(tx, ty);
    // Pixi scales before it rotates: the nose starts at (dir, 0) and is then turned by rotation.
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return { x: dir * cos, y: dir * sin };
  }

  const directions: [string, number, number][] = [
    ['east', 1, 0],
    ['west', -1, 0],
    ['north', 0, -1],
    ['south', 0, 1],
    ['north-east', 0.6, -0.8],
    ['north-west', -0.6, -0.8],
    ['south-east', 0.6, 0.8],
    ['south-west', -0.6, 0.8],
  ];

  it.each(directions)('points a sprite %s when it travels that way', (_name, tx, ty) => {
    const aim = aimedAt(tx, ty);
    expect(aim.x).toBeCloseTo(tx, 6);
    expect(aim.y).toBeCloseTo(ty, 6);
  });

  it('mirrors only what is heading left', () => {
    expect(spriteFacing(1, -1).dir).toBe(1);
    expect(spriteFacing(0, -1).dir).toBe(1);
    expect(spriteFacing(-1, -1).dir).toBe(-1);
  });

  it('does not invert the climb when mirrored', () => {
    // The regression this exists for: a shark on the exodus's left lane, climbing up and to the
    // left, was drawn heading down and to the left instead.
    expect(aimedAt(-0.7, -0.7).y).toBeLessThan(0);
    expect(aimedAt(-0.7, 0.7).y).toBeGreaterThan(0);
  });
});
