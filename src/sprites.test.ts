import { describe, expect, it } from 'vitest';
import { PHOTOPHORE_ALPHA_PEAK, PHOTOPHORE_ALPHA_REST, photophorePulseAlpha } from './sprites';

/** One full cycle, matching PHOTOPHORE_PULSE_PERIOD_MS in sprites.ts. */
const PERIOD = 2600;

/** Sample one whole cycle for a given shark at a fine step. */
function cycle(seed: number, step = 10): number[] {
  const out: number[] = [];
  for (let t = 0; t < PERIOD; t += step) out.push(photophorePulseAlpha(t, seed));
  return out;
}

describe('photophorePulseAlpha', () => {
  it('never goes dark, so a glowing shark is always findable', () => {
    for (const seed of [0, 1, 2, 7, 13, 40]) {
      expect(Math.min(...cycle(seed))).toBeGreaterThanOrEqual(PHOTOPHORE_ALPHA_REST);
    }
  });

  it('stays within the resting and peak bounds', () => {
    const values = cycle(3, 1);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(PHOTOPHORE_ALPHA_REST);
    expect(Math.max(...values)).toBeLessThanOrEqual(PHOTOPHORE_ALPHA_PEAK);
  });

  it('actually flares - it reaches near peak once per cycle', () => {
    const values = cycle(0, 1);
    expect(Math.max(...values)).toBeGreaterThan(PHOTOPHORE_ALPHA_PEAK - 0.01);
  });

  it('rests for most of the cycle rather than breathing continuously', () => {
    const values = cycle(0, 1);
    const resting = values.filter((v) => v === PHOTOPHORE_ALPHA_REST).length;
    // The flare is 28% of the cycle, so a little over two thirds should sit at rest.
    expect(resting / values.length).toBeGreaterThan(0.65);
  });

  it('repeats every period', () => {
    for (const t of [0, 250, 900, 2100]) {
      expect(photophorePulseAlpha(t, 5)).toBeCloseTo(photophorePulseAlpha(t + PERIOD, 5), 10);
    }
  });

  it('gives each shark its own phase, so a shoal never flares in unison', () => {
    // Peak times across a group should be spread around the cycle, not stacked on one moment.
    const peaks = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => {
      const values = cycle(seed, 1);
      return values.indexOf(Math.max(...values));
    });
    expect(new Set(peaks).size).toBe(peaks.length);
  });

  it('is continuous across the flare edges - no visible snap back to rest', () => {
    const values = cycle(0, 1);
    let biggestStep = 0;
    for (let i = 1; i < values.length; i++) {
      biggestStep = Math.max(biggestStep, Math.abs(values[i] - values[i - 1]));
    }
    // A half sine over 728ms moves far less than this per millisecond; a hard cut would jump
    // the full rest-to-peak distance in one step.
    expect(biggestStep).toBeLessThan(0.05);
  });

  it('handles a zero timestamp and a default seed', () => {
    expect(Number.isFinite(photophorePulseAlpha(0))).toBe(true);
    expect(photophorePulseAlpha(0)).toBeGreaterThanOrEqual(PHOTOPHORE_ALPHA_REST);
  });
});
