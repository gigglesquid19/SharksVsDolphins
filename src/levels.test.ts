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

  it('brings the matriarch back every 5 levels past the campaign', () => {
    expect(getEndlessLevelConfig(15).matriarch).toBe(true);
    expect(getEndlessLevelConfig(20).matriarch).toBe(true);
    expect(getEndlessLevelConfig(17).matriarch).toBe(false);
  });
});

describe('getLevelBackground', () => {
  it('maps campaign levels 1-10 directly', () => {
    expect(getLevelBackground(1)).toBe('levels/1.webp');
    expect(getLevelBackground(10)).toBe('levels/10.webp');
  });

  it('cycles backgrounds for endless levels beyond 10', () => {
    expect(getLevelBackground(11)).toBe('levels/1.webp');
    expect(getLevelBackground(20)).toBe('levels/10.webp');
  });
});
