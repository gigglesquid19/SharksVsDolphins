import { describe, expect, it } from 'vitest';
import {
  DEEP_JELLYFISH,
  PHOTOPHORE_ALPHA_PEAK,
  PHOTOPHORE_ALPHA_REST,
  SHALLOW_JELLYFISH,
  jellyfishFlashAlpha,
  photophorePulseAlpha,
} from './sprites';

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

describe("the deep swarm's alarm", () => {
  const FLASH_PERIOD = 2600;
  /** Samples one whole cycle finely enough to see every flash and gap. */
  const cycle = (seed: number, step = 5): number[] => {
    const out: number[] = [];
    for (let t = 0; t < FLASH_PERIOD; t += step) out.push(jellyfishFlashAlpha(t, seed));
    return out;
  };

  it('spends most of its time dark', () => {
    const lit = cycle(0).filter((a) => a > 0.5).length;
    const total = cycle(0).length;
    expect(lit / total).toBeLessThan(0.15);
  });

  it('flashes three times a cycle, not once and not continuously', () => {
    // Count runs of lit samples rather than lit samples themselves.
    const samples = cycle(0);
    let bursts = 0;
    for (let i = 0; i < samples.length; i++) {
      const lit = samples[i] > 0.5;
      const wasLit = i > 0 && samples[i - 1] > 0.5;
      if (lit && !wasLit) bursts++;
    }
    expect(bursts).toBe(3);
  });

  it('goes fully bright and properly dark rather than hovering between', () => {
    const values = new Set(cycle(0).map((a) => Math.round(a * 100)));
    expect([...values].sort((a, b) => a - b)).toEqual([5, 100]);
  });

  it('repeats on its period', () => {
    for (const t of [0, 137, 940, 2599]) {
      expect(jellyfishFlashAlpha(t, 3)).toBe(jellyfishFlashAlpha(t + FLASH_PERIOD, 3));
    }
  });

  it('staggers the swarm, so fifty of them are not one light show', () => {
    // At any one instant a spread of seeds must not all be doing the same thing.
    const atOneMoment = Array.from({ length: 50 }, (_, id) => jellyfishFlashAlpha(1000, id));
    const lit = atOneMoment.filter((a) => a > 0.5).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(50);
  });

  it('keeps the two swarms distinct: one flashes, the other does not', () => {
    expect(DEEP_JELLYFISH.luminous).toBe(true);
    expect(SHALLOW_JELLYFISH.luminous).toBe(false);
    // Blue light through water, over a body that stays dark red.
    expect(DEEP_JELLYFISH.glow & 0xff).toBeGreaterThan((DEEP_JELLYFISH.glow >> 16) & 0xff);
    expect((DEEP_JELLYFISH.bell >> 16) & 0xff).toBeGreaterThan(DEEP_JELLYFISH.bell & 0xff);
  });
});
