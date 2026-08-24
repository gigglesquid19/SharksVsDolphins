import { describe, expect, it } from 'vitest';
import { clampEntityY, clampX, directionDelta, wrapX } from './utils';

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
