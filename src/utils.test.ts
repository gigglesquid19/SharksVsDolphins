import { describe, expect, it } from 'vitest';
import { clampEntityY, clampX, directionDelta, sweptDistance, wrapX } from './utils';

describe('wrapX', () => {
  it('leaves in-bounds values unchanged', () => {
    expect(wrapX(0)).toBe(0);
    expect(wrapX(50)).toBe(50);
  });

  it('wraps values past the right edge', () => {
    expect(wrapX(150)).toBe(50);
    expect(wrapX(100)).toBe(0);
  });

  it('wraps negative values from the left edge', () => {
    expect(wrapX(-10)).toBe(90);
  });
});

describe('clampX', () => {
  it('leaves in-bounds values unchanged', () => {
    expect(clampX(50)).toBe(50);
  });

  it('clamps above the upper bound', () => {
    expect(clampX(150)).toBe(100);
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
    expect(clampEntityY(150, 2)).toBe(97);
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
    expect(directionDelta(10, 90)).toBe(20);
  });

  it('takes the shorter wrapped path across the left edge', () => {
    expect(directionDelta(90, 10)).toBe(-20);
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
    expect(sweptDistance(at(99, 50, 1, 50), at(2, 50, 2, 50))).toBeCloseTo(1);
  });

  it('is symmetric in its arguments', () => {
    const a = at(44, 50, 56, 51);
    const b = at(50, 47, 50, 55);
    expect(sweptDistance(a, b)).toBeCloseTo(sweptDistance(b, a));
  });
});
