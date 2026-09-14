import { describe, expect, it } from 'vitest';
import { SIZE_X, SIZE_Y } from './constants';
import { clampEntityY, clampX, directionDelta, sweptDistance, weightedPick, wrapX } from './utils';

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

describe('weightedPick', () => {
  const events = ['jellyfish', 'megamouth', 'kraken'] as const;
  type Event = (typeof events)[number];
  /** The Mesopelagic's own weights: the kraken at half of either neighbour. */
  const weight = (e: Event): number => (e === 'kraken' ? 1 : 2);

  it('gives nothing to pick from back as null', () => {
    expect(weightedPick([], () => 1, 0.5)).toBeNull();
    expect(weightedPick(events, () => 0, 0.5)).toBeNull();
  });

  it('returns the only option whatever the roll', () => {
    for (const roll of [0, 0.5, 1]) expect(weightedPick(['kraken'], weight, roll)).toBe('kraken');
  });

  it('hands each option the slice its weight buys', () => {
    // Weights 2,2,1 over five: jellyfish 0-0.4, megamouth 0.4-0.8, kraken 0.8-1.
    expect(weightedPick(events, weight, 0)).toBe('jellyfish');
    expect(weightedPick(events, weight, 0.39)).toBe('jellyfish');
    expect(weightedPick(events, weight, 0.41)).toBe('megamouth');
    expect(weightedPick(events, weight, 0.79)).toBe('megamouth');
    expect(weightedPick(events, weight, 0.81)).toBe('kraken');
    expect(weightedPick(events, weight, 1)).toBe('kraken');
  });

  it('lands the kraken on a fifth of rolls, not a third', () => {
    let krakens = 0;
    const SAMPLES = 10000;
    for (let i = 0; i < SAMPLES; i++) {
      if (weightedPick(events, weight, (i + 0.5) / SAMPLES) === 'kraken') krakens++;
    }
    expect(krakens / SAMPLES).toBeCloseTo(0.2, 2);
  });

  it('treats a negative weight as zero rather than stealing from the pool', () => {
    expect(weightedPick(['kraken', 'megamouth'], (e) => (e === 'kraken' ? -5 : 1), 0.5)).toBe('megamouth');
  });

  it('clamps a roll outside 0..1 onto the ends', () => {
    expect(weightedPick(events, weight, -1)).toBe('jellyfish');
    expect(weightedPick(events, weight, 2)).toBe('kraken');
  });
});
