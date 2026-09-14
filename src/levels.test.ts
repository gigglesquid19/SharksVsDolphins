import { describe, expect, it } from 'vitest';
import {
  DEPTH_ZONES,
  LEVELS,
  MAX_ENDLESS_SHARK_SPEED,
  SHARK_SPEED_CAP_LEVEL,
  getEndlessLevelConfig,
  getLevelBackground,
  getLevelConfig,
  isMesopelagicLevel,
  isSandboxLevel,
  MESOPELAGIC_LEVELS,
  SANDBOX_LEVELS,
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

describe('the shark sandboxes', () => {
  it('gives each test depth a known roster, or nothing at all', () => {
    // 21 mirrors level 11's water on purpose: the deep events are watched there against a shark
    // mix that is already understood, rather than against a new one at the same time.
    expect(getLevelConfig(21).sharkKinds).toEqual(['cookiecutter', 'frilled']);
    expect(getLevelConfig(31).sharkKinds).toEqual([]);
    for (const level of [21, 31]) {
      const config = getLevelConfig(level);
      expect(config.largeSharkCount).toBe(0);
      expect(config.matriarch).toBe(false);
      expect(config.normalSharkCount).toBe(config.sharkKinds.length > 0 ? config.normalSharkCount : 0);
    }
  });

  it('keeps every sandbox dark, and darker the deeper it is', () => {
    const gloom = [21, 31].map((level) => getLevelConfig(level).gloom ?? 0);
    expect(gloom.every((g) => g > 0 && g <= 1)).toBe(true);
    expect(gloom[0]).toBeLessThan(gloom[1]);
  });

  it('changes nothing else about them, so a shark put in one behaves as it would anywhere', () => {
    // Everything but the shark list still sits on the curve the surrounding levels are on, so a
    // shark dropped in here is as fast, and faces as big a pod, as it would one level either side.
    for (const level of [21, 31]) {
      const before = getLevelConfig(level - 1);
      const sandbox = getLevelConfig(level);
      const after = getLevelConfig(level + 1);
      expect(sandbox.level).toBe(level);
      expect(sandbox.maxDolphins).toBeGreaterThanOrEqual(before.maxDolphins);
      expect(sandbox.maxDolphins).toBeLessThanOrEqual(after.maxDolphins);
      expect(sandbox.sharkSpeedMultiplier).toBeGreaterThan(before.sharkSpeedMultiplier);
      expect(sandbox.sharkSpeedMultiplier).toBeLessThan(after.sharkSpeedMultiplier);
    }
  });

  it('touches no other depth', () => {
    for (let level = 1; level <= 50; level++) {
      if (isSandboxLevel(level) || isMesopelagicLevel(level)) continue;
      const config = getLevelConfig(level);
      expect(config.normalSharkCount).toBeGreaterThan(0);
      expect(config.gloom).toBeUndefined();
    }
    expect(Object.keys(SANDBOX_LEVELS).map(Number)).toEqual([21, 31]);
  });

  it('opens a zone with each sandbox, so they are easy to find', () => {
    for (const level of [21, 31]) expect(zoneEnteredAt(level)).not.toBeNull();
  });
});

describe('the authored Mesopelagic, levels 11-20', () => {
  const zone = () => Array.from({ length: 10 }, (_, i) => getLevelConfig(11 + i));

  it('covers exactly 11 to 20', () => {
    expect(Object.keys(MESOPELAGIC_LEVELS).map(Number)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(isMesopelagicLevel(10)).toBe(false);
    expect(isMesopelagicLevel(21)).toBe(false);
  });

  it('runs the same shark curve levels 1-10 run', () => {
    expect(zone().map((c) => c.normalSharkCount)).toEqual(LEVELS.map((c) => c.normalSharkCount));
    expect(zone().map((c) => c.largeSharkCount)).toEqual(LEVELS.map((c) => c.largeSharkCount));
  });

  it('opens on the two deep-water species alone, and deals them in turn', () => {
    for (const level of [11, 12, 13, 14, 15]) {
      const config = getLevelConfig(level);
      expect(config.sharkKinds).toEqual(['cookiecutter', 'frilled']);
      expect(config.dealKindsInTurn).toBe(true);
    }
  });

  it('folds the shallow-water sharks back in from 16, and stops dealing in turn', () => {
    expect(getLevelConfig(16).sharkKinds).toContain('hammerhead');
    expect(getLevelConfig(19).sharkKinds).toContain('greatWhite');
    for (const level of [16, 17, 18, 19, 20]) {
      expect(getLevelConfig(level).dealKindsInTurn).toBeUndefined();
    }
  });

  it('never fields a tiger, at any size', () => {
    // Tigers carry no photophores and cloak on top of it, which in this much dark is a shark you
    // can neither see nor anticipate. The zone drops them rather than tuning around them.
    for (let level = 11; level <= 20; level++) {
      expect(getLevelConfig(level).sharkKinds).not.toContain('tiger');
    }
  });

  it('never drops a species once it has been introduced', () => {
    for (let level = 12; level <= 20; level++) {
      const before = getLevelConfig(level - 1).sharkKinds;
      const now = getLevelConfig(level).sharkKinds;
      for (const kind of before) expect(now).toContain(kind);
    }
  });

  it('holds the first large to the cheaper species, so 12 pod is never the only option', () => {
    // Large sharks restart the deal at the pool's first entry, so the single large on 13 and 14
    // is a cookiecutter at 8 pod; the large frilled at 12 waits for 15, where there are two.
    for (const level of [13, 14]) {
      const config = getLevelConfig(level);
      expect(config.largeSharkCount).toBe(1);
      expect(config.sharkKinds[0]).toBe('cookiecutter');
    }
    expect(getLevelConfig(15).largeSharkCount).toBe(2);
  });

  it('darkens steadily from level 10s daylight to the zone floor', () => {
    const gloom = zone().map((c) => c.gloom ?? 0);
    expect(getLevelConfig(10).gloom ?? 0).toBe(0);
    expect(gloom[0]).toBeCloseTo(0.35, 5);
    expect(gloom[9]).toBeCloseTo(0.62, 5);
    for (let i = 1; i < gloom.length; i++) expect(gloom[i]).toBeGreaterThan(gloom[i - 1]);
    expect(gloom.every((g) => g > 0 && g < 1)).toBe(true);
  });

  it('holds the pod limit flat, so the curve is sharks and darkness rather than pod growth', () => {
    expect(zone().map((c) => c.maxDolphins)).toEqual(Array(10).fill(15));
  });

  it('keeps the speed climbing on the endless line rather than forking its own', () => {
    for (let level = 12; level <= 20; level++) {
      expect(getLevelConfig(level).sharkSpeedMultiplier).toBeGreaterThan(
        getLevelConfig(level - 1).sharkSpeedMultiplier,
      );
    }
  });

  it('marks its last level as a boss, which is what keeps jellyfish off it', () => {
    // Game.jellyfishAllowed excludes any level whose config carries a Matriarch, rather than
    // naming 10 and 20, so this flag is what the exclusion actually rests on.
    expect(getLevelConfig(20).matriarch).toBe(true);
    expect(LEVELS[9].matriarch).toBe(true);
  });

  it('is the stretch that game.ts turns storms off over', () => {
    // Game.stormsAllowed keys off exactly this, so the two have to agree on where the zone is:
    // a storm is a visibility mechanic and the zone already runs its own darkness. Jellyfish are
    // gated separately, by level, and do reach into this zone.
    for (let level = 11; level <= 20; level++) expect(isMesopelagicLevel(level)).toBe(true);
    expect(isMesopelagicLevel(10)).toBe(false);
    expect(isMesopelagicLevel(21)).toBe(false);
  });

  it('ends the zone on a Matriarch, the way level 10 ends the campaign', () => {
    expect(getLevelConfig(20).matriarch).toBe(true);
    for (let level = 11; level <= 19; level++) expect(getLevelConfig(level).matriarch).toBe(false);
  });
});
