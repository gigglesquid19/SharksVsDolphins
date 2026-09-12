import { describe, expect, it } from 'vitest';
import {
  DEPTH_ZONES,
  LEVELS,
  MAX_ENDLESS_SHARK_SPEED,
  SHARK_SPEED_CAP_LEVEL,
  getEndlessLevelConfig,
  getLevelBackground,
  getLevelConfig,
  zoneClearedAt,
  zoneEnteredAt,
  zoneForLevel,
} from './levels';

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
  it('escalates shark speed while the cap is still above it', () => {
    const near = getEndlessLevelConfig(15);
    const far = getEndlessLevelConfig(30);
    expect(far.sharkSpeedMultiplier).toBeGreaterThan(near.sharkSpeedMultiplier);
    expect(far.sharkSpeedMultiplier).toBeLessThan(MAX_ENDLESS_SHARK_SPEED);
  });

  it('reaches the speed ceiling exactly at the end of the last zone', () => {
    expect(getEndlessLevelConfig(SHARK_SPEED_CAP_LEVEL - 1).sharkSpeedMultiplier).toBeLessThan(
      MAX_ENDLESS_SHARK_SPEED,
    );
    expect(getEndlessLevelConfig(SHARK_SPEED_CAP_LEVEL).sharkSpeedMultiplier).toBeCloseTo(
      MAX_ENDLESS_SHARK_SPEED,
      6,
    );
  });

  it('holds at the ceiling however deep a run goes', () => {
    expect(getEndlessLevelConfig(SHARK_SPEED_CAP_LEVEL + 1).sharkSpeedMultiplier).toBe(
      MAX_ENDLESS_SHARK_SPEED,
    );
    expect(getEndlessLevelConfig(500).sharkSpeedMultiplier).toBe(MAX_ENDLESS_SHARK_SPEED);
  });

  it('climbs evenly through every zone rather than topping out early', () => {
    // The point of moving the cap to level 50: each zone should still be faster than the last.
    const atZoneEnds = [20, 30, 40, 50].map((lv) => getEndlessLevelConfig(lv).sharkSpeedMultiplier);
    for (let i = 1; i < atZoneEnds.length; i++) {
      expect(atZoneEnds[i]).toBeGreaterThan(atZoneEnds[i - 1]);
    }
  });

  it('starts the climb from where the campaign left off', () => {
    const first = getEndlessLevelConfig(LEVELS.length + 1).sharkSpeedMultiplier;
    expect(first).toBeGreaterThan(LEVELS[LEVELS.length - 1].sharkSpeedMultiplier);
    // Slowly: a single level must not move it by more than a fiftieth.
    expect(first - LEVELS[LEVELS.length - 1].sharkSpeedMultiplier).toBeLessThan(0.02);
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

describe('depth zones', () => {
  it('covers levels 1-50 in five zones of ten, with no gaps or overlaps', () => {
    expect(DEPTH_ZONES).toHaveLength(5);
    DEPTH_ZONES.forEach((zone, i) => {
      expect(zone.lastLevel - zone.firstLevel).toBe(9);
      if (i > 0) expect(zone.firstLevel).toBe(DEPTH_ZONES[i - 1].lastLevel + 1);
    });
    expect(DEPTH_ZONES[0].firstLevel).toBe(1);
    expect(DEPTH_ZONES[4].lastLevel).toBe(50);
  });

  it('places each level in its zone', () => {
    expect(zoneForLevel(1).name).toBe('Eutrophic');
    expect(zoneForLevel(10).name).toBe('Eutrophic');
    expect(zoneForLevel(11).name).toBe('Mesopelagic');
    expect(zoneForLevel(25).name).toBe('Bathypelagic');
    expect(zoneForLevel(31).name).toBe('Abyssopelagic');
    expect(zoneForLevel(50).name).toBe('Hadal');
  });

  it('keeps a run past level 50 in the Hadal rather than resurfacing', () => {
    expect(zoneForLevel(51).name).toBe('Hadal');
    expect(zoneForLevel(120).name).toBe('Hadal');
  });

  it('announces a zone only on the level that opens it', () => {
    expect(zoneEnteredAt(11)?.name).toBe('Mesopelagic');
    expect(zoneEnteredAt(41)?.name).toBe('Hadal');
    expect(zoneEnteredAt(12)).toBeNull();
    expect(zoneEnteredAt(51)).toBeNull();
  });

  it('announces a liberation only on the level that closes a zone', () => {
    expect(zoneClearedAt(20)?.name).toBe('Mesopelagic');
    expect(zoneClearedAt(50)?.name).toBe('Hadal');
    expect(zoneClearedAt(19)).toBeNull();
    expect(zoneClearedAt(60)).toBeNull();
  });

  it('gives every zone a depth range to show under its name', () => {
    for (const zone of DEPTH_ZONES) expect(zone.depth).toMatch(/m/);
  });

  it('runs the depths continuously, with no gap between one zone and the next', () => {
    // Each card shows a range, and a player reading them in order should be able to add them
    // up. The last zone is open-ended ("4000m+"), so it only has to start where 40 ended.
    const bounds = DEPTH_ZONES.map((z) => (z.depth.match(/\d+/g) ?? []).map(Number));
    bounds.forEach((pair, i) => {
      if (i > 0) expect(pair[0]).toBe(bounds[i - 1][1]);
      if (i < bounds.length - 1) expect(pair[1]).toBeGreaterThan(pair[0]);
    });
  });
});
