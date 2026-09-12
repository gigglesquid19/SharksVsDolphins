import { describe, expect, it } from 'vitest';
import { LEVELS, getEndlessLevelConfig, getLevelBackground, getLevelConfig } from './levels';

describe('getLevelConfig', () => {
  it('returns the authored campaign config for levels 1-10', () => {
    expect(getLevelConfig(1)).toBe(LEVELS[0]);
    expect(getLevelConfig(10)).toBe(LEVELS[9]);
  });

  it('falls through to endless scaling past level 10', () => {
    const config = getLevelConfig(11);
    expect(config.level).toBe(11);
    expect(config.sharkSpeedMultiplier).toBeGreaterThan(LEVELS[9].sharkSpeedMultiplier);
  });
});

describe('getEndlessLevelConfig', () => {
  it('keeps escalating shark speed indefinitely', () => {
    const near = getEndlessLevelConfig(15);
    const far = getEndlessLevelConfig(50);
    expect(far.sharkSpeedMultiplier).toBeGreaterThan(near.sharkSpeedMultiplier);
  });

  it('caps shark counts and pod size so late levels stay playable', () => {
    const config = getEndlessLevelConfig(200);
    expect(config.normalSharkCount).toBeLessThanOrEqual(16);
    expect(config.largeSharkCount).toBeLessThanOrEqual(10);
    expect(config.maxDolphins).toBeLessThanOrEqual(20);
  });

  it('brings the matriarch back every 10 levels past the campaign', () => {
    expect(getEndlessLevelConfig(20).matriarch).toBe(true);
    expect(getEndlessLevelConfig(30).matriarch).toBe(true);
    expect(getEndlessLevelConfig(15).matriarch).toBe(false);
    expect(getEndlessLevelConfig(25).matriarch).toBe(false);
  });
});

describe('getLevelBackground', () => {
  it('maps campaign levels 1-10 directly', () => {
    expect(getLevelBackground(1)).toBe('/levels/1.webp');
    expect(getLevelBackground(10)).toBe('/levels/10.webp');
  });

  it('gives Endless its own art from the very first level', () => {
    expect(getLevelBackground(1, 'endless')).toBe('/levels/endless/1.webp');
    expect(getLevelBackground(10, 'endless')).toBe('/levels/endless/10.webp');
    expect(getLevelBackground(11, 'endless')).toBe('/levels/endless/11.webp');
    expect(getLevelBackground(50, 'endless')).toBe('/levels/endless/50.webp');
  });

  it('cycles the Endless set once a run passes 50', () => {
    expect(getLevelBackground(51, 'endless')).toBe('/levels/endless/1.webp');
    expect(getLevelBackground(100, 'endless')).toBe('/levels/endless/50.webp');
  });

  it('defaults to the campaign set when no mode is given', () => {
    expect(getLevelBackground(11)).toBe('/levels/1.webp');
  });
});
