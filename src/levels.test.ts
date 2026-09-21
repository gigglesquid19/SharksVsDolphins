import { describe, expect, it } from 'vitest';
import type { SharkKind } from './sprites';
import {
  ConversationLine,
  DEPTH_ZONES,
  GREAT_WHITE_PAIR_FROM_LEVEL,
  MATRIARCH_DEFEAT_LEVELS,
  MATRIARCH_LEVELS,
  matriarchDefeatConversation,
  LEVELS,
  CAMPAIGN_LARGE_SHARK_COUNTS,
  SMALL_BEFORE_LARGE_UNTIL_LEVEL,
  descentLevels,
  OPENING_STORY_LEVEL,
  STORY_INTERSTITIALS,
  dealLargeSharkKinds,
  getStoryInterstitialBackground,
  storyInterstitialAfter,
  getLevelConfigForMode,
  largeKindPool,
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
    expect(config.normalSharkCount).toBeLessThanOrEqual(15);
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

describe('story interstitials', () => {
  const endlessScreens = STORY_INTERSTITIALS.filter((s) => s.mode === 'endless');

  it('sits after the levels the art was drawn for', () => {
    expect([...endlessScreens.map((s) => s.afterLevel)].sort((a, b) => a - b)).toEqual([
      10, 17, 20, 29, 30, 34, 39, 40,
    ]);
  });

  it('names each screen after the level it follows', () => {
    for (const s of STORY_INTERSTITIALS) expect(s.id).toBe(`${s.afterLevel}a`);
  });

  it('finds the screen that follows a level, and nothing anywhere else', () => {
    expect(storyInterstitialAfter(10, 'endless')?.id).toBe('10a');
    expect(storyInterstitialAfter(39, 'endless')?.id).toBe('39a');
    expect(storyInterstitialAfter(9, 'endless')).toBeNull();
    expect(storyInterstitialAfter(11, 'endless')).toBeNull();
    expect(storyInterstitialAfter(41, 'endless')).toBeNull();
  });

  it('keeps each mode to its own story screens', () => {
    // The two modes share the level-10 art but not the screen: the Campaign's ends its run and
    // the Depthless one is swum through, so a lookup must never cross modes.
    expect(storyInterstitialAfter(OPENING_STORY_LEVEL, 'campaign')?.id).toBe('0a');
    expect(storyInterstitialAfter(OPENING_STORY_LEVEL, 'endless')).toBeNull();
    expect(storyInterstitialAfter(10, 'campaign')?.endsRun).toBe(true);
    expect(storyInterstitialAfter(10, 'endless')?.endsRun).toBeUndefined();
    expect(storyInterstitialAfter(17, 'campaign')).toBeNull();
  });

  it('ends the Campaign on 10a, after the Matriarch rather than on her', () => {
    const finale = storyInterstitialAfter(LEVELS.length, 'campaign');
    // Level 10 is the Matriarch level and the last the Campaign defines, so beating her leads
    // onto this screen and the screen is where the run stops - there is no level 11 behind it.
    expect(finale?.id).toBe('10a');
    expect(finale?.endsRun).toBe(true);
    expect(storyInterstitialAfter(LEVELS.length + 1, 'campaign')).toBeNull();
  });

  it('bookends the Campaign with its two spectacles and leaves every Depthless screen plain', () => {
    // The tiger pack opens the Campaign and the exodus closes it. The Matriarch's defeat is not a
    // screen spectacle at all - it happens in the level itself, before any of these screens are
    // ever reached - so no Depthless screen carries a spectacle of its own.
    expect(storyInterstitialAfter(OPENING_STORY_LEVEL, 'campaign')?.spectacle).toBe('tigerPatrol');
    expect(storyInterstitialAfter(10, 'campaign')?.spectacle).toBe('sharkExodus');
    expect(STORY_INTERSTITIALS.filter((s) => s.mode === 'endless' && s.spectacle)).toHaveLength(0);
  });

  it('gates the exit only on the screen the player is meant to watch first', () => {
    // 0a holds its prompt back until the pack has left, because following it is the instruction.
    // Every Depthless screen, the three that follow a scripted defeat included, can be crossed
    // the moment it appears - whatever happened to the Matriarch is already over by then.
    expect(storyInterstitialAfter(OPENING_STORY_LEVEL, 'campaign')?.exitAfterSpectacle).toBe(true);
    expect(storyInterstitialAfter(10, 'campaign')?.exitAfterSpectacle).toBeUndefined();
    const gated = STORY_INTERSTITIALS.filter((s) => s.exitAfterSpectacle);
    expect(gated).toHaveLength(1);
    // A gated screen with no spectacle would never open, so the two must travel together.
    for (const s of gated) expect(s.spectacle).toBeDefined();
  });

  it('ends no run the player is meant to swim out of', () => {
    // Only the Campaign finale stops a run. Every Depthless screen is a crossing, and the
    // Campaign's opening screen leads into level 1.
    const ending = STORY_INTERSTITIALS.filter((s) => s.endsRun);
    expect(ending).toHaveLength(1);
    expect(ending[0]).toMatchObject({ mode: 'campaign', afterLevel: 10 });
  });

  it('opens the Campaign on 0a, before level 1 rather than after a level', () => {
    const opening = storyInterstitialAfter(OPENING_STORY_LEVEL, 'campaign');
    expect(OPENING_STORY_LEVEL).toBe(0);
    expect(opening?.mode).toBe('campaign');
    // Nothing is ever cleared to reach it - there is no level 0 - so it can only be a run's start.
    expect(LEVELS.some((l) => l.level === OPENING_STORY_LEVEL)).toBe(false);
  });

  it('descends at every zone boundary and nowhere else', () => {
    // The four boundaries between the five depth zones. 50 is the floor of the Hadal: the last
    // zone, with nothing below it. Not every one of these still has a Matriarch guarding it - see
    // MATRIARCH_LEVELS - the zone transition and the boss fight are two separate things that used
    // to always coincide and now only mostly do.
    expect(descentLevels('endless')).toEqual([10, 20, 30, 40]);
    for (const zone of DEPTH_ZONES.slice(0, -1)) {
      expect(storyInterstitialAfter(zone.lastLevel, 'endless')?.descend).toBe(true);
    }
    expect(storyInterstitialAfter(DEPTH_ZONES[DEPTH_ZONES.length - 1].lastLevel, 'endless')).toBeNull();
  });

  it('descends only on a tenth level, whether or not a Matriarch is there', () => {
    // The zone boundary itself is what a descent marks, not the boss - 40 proves the two are
    // independent: still a descend level, no Matriarch there any more (see MATRIARCH_LEVELS).
    for (const level of descentLevels('endless')) expect(level % 10).toBe(0);
  });

  it('has a Matriarch behind three of its four descents, not all of them', () => {
    for (const level of descentLevels('endless')) {
      expect(getLevelConfigForMode(level, 'endless').matriarch).toBe(MATRIARCH_LEVELS.includes(level));
    }
    expect(getLevelConfigForMode(40, 'endless').matriarch).toBe(false);
  });

  it('keeps the mid-zone screens as ordinary east crossings', () => {
    // These are story beats rather than zone changes: no Matriarch behind them, no descent.
    for (const level of [17, 29, 34, 39]) {
      const screen = storyInterstitialAfter(level, 'endless');
      expect(screen?.descend).toBeUndefined();
      expect(getLevelConfigForMode(level, 'endless').matriarch).toBe(false);
    }
  });

  describe('MATRIARCH_LEVELS', () => {
    it('spawns a Matriarch only on 10, 20, 30 and 50 - not on every tenth level', () => {
      expect([...MATRIARCH_LEVELS].sort((a, b) => a - b)).toEqual([10, 20, 30, 50]);
      // The old rule was "every tenth level forever" - 40, 60, 70 and 80 would all have matched
      // that and must not spawn one now.
      for (const level of [40, 60, 70, 80]) expect(MATRIARCH_LEVELS.includes(level)).toBe(false);
    });

    it('is what getEndlessLevelConfig actually reads, not a parallel list', () => {
      for (let level = 10; level <= 80; level += 10) {
        expect(getEndlessLevelConfig(level).matriarch).toBe(MATRIARCH_LEVELS.includes(level));
      }
    });
  });

  describe("the Matriarch's defeat conversation", () => {
    const scriptedLevels = [...MATRIARCH_DEFEAT_LEVELS];

    it('is scripted for 10, 20 and 30 - a subset of MATRIARCH_LEVELS, not all of it', () => {
      expect([...scriptedLevels].sort((a, b) => a - b)).toEqual([10, 20, 30]);
      for (const level of scriptedLevels) expect(MATRIARCH_LEVELS.includes(level)).toBe(true);
      for (const level of scriptedLevels) {
        expect(matriarchDefeatConversation(level)?.length).toBeGreaterThan(0);
      }
      // 50 spawns a Matriarch (see MATRIARCH_LEVELS) but has no script yet, so she still flees and
      // returns there like any other unscripted encounter.
      expect(matriarchDefeatConversation(50)).toBeNull();
      for (const level of [17, 29, 34, 39, 40]) expect(matriarchDefeatConversation(level)).toBeNull();
    });

    it('is not attached to any story screen - it plays in the level, not on the (a) after it', () => {
      // The whole reason for this change: the old version put the conversation and her sunk body
      // on the screen after the level. Nothing on StoryInterstitial should carry it any more.
      for (const s of STORY_INTERSTITIALS) {
        expect((s as { conversation?: unknown }).conversation).toBeUndefined();
      }
    });

    it('is still a placeholder script, clearly marked as one', () => {
      // Every line ships marked [PLACEHOLDER] until it is replaced with the real writing - this
      // is the trip-wire that catches a placeholder script accidentally shipping as final text.
      for (const level of scriptedLevels) {
        const lines = matriarchDefeatConversation(level)!;
        for (const line of lines) expect(line.line).toContain('[PLACEHOLDER]');
      }
    });

    it('alternates speakers, opening and closing with the same one', () => {
      for (const level of scriptedLevels) {
        const lines: ConversationLine[] = matriarchDefeatConversation(level)!;
        expect(lines[0].speaker).toBe('matriarch');
        for (let i = 1; i < lines.length; i++) expect(lines[i].speaker).not.toBe(lines[i - 1].speaker);
      }
    });

    it('writes a different script for each of the three encounters', () => {
      // Not a content check - the placeholders are not the real writing - just a guard against a
      // copy-paste that gave three levels the exact same lines.
      const scripts = scriptedLevels.map((level) =>
        matriarchDefeatConversation(level)!.map((l) => l.line).join('|'),
      );
      expect(new Set(scripts).size).toBe(scriptedLevels.length);
    });
  });

  it('tells each beat once, not once per lap of the Endless backgrounds', () => {
    // Level 60 draws background 10, but the story after level 10 has already been told.
    expect(storyInterstitialAfter(60, 'endless')).toBeNull();
    expect(storyInterstitialAfter(67, 'endless')).toBeNull();
  });

  it('sits on the tenth level it names, not a level shifted by having been inserted', () => {
    // The whole reason these are not numbered levels: inserting one would shift every depth
    // above it off the tens. Every descend screen's own afterLevel is checked directly against
    // that arithmetic, rather than through the matriarch flag - MATRIARCH_LEVELS is now an
    // independent list, not derived from afterLevel, so it no longer proves this on its own.
    for (const s of endlessScreens.filter((s) => s.descend)) {
      expect(s.afterLevel % 10).toBe(0);
    }
  });

  it('loads its art from the background set of its own mode', () => {
    // Both modes have a 10a and they are different files; the mode is what tells them apart.
    const campaign10a = storyInterstitialAfter(10, 'campaign')!;
    const endless10a = storyInterstitialAfter(10, 'endless')!;
    expect(getStoryInterstitialBackground(campaign10a)).toBe('/levels/10a.webp');
    expect(getStoryInterstitialBackground(endless10a)).toBe('/levels/endless/10a.webp');
    expect(getStoryInterstitialBackground(storyInterstitialAfter(OPENING_STORY_LEVEL, 'campaign')!)).toBe(
      '/levels/0a.webp',
    );
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

  it('runs the same shark curve levels 1-10 run, except one fewer large on the boss level', () => {
    expect(zone().map((c) => c.normalSharkCount)).toEqual(LEVELS.map((c) => c.normalSharkCount));
    const levelLargeCounts = LEVELS.map((c) => c.largeSharkCount);
    // Levels 11-19 mirror 1-9 exactly; level 20 deliberately breaks from level 10's 4, down to
    // 3 - a level whose great white and hammerhead carry no photophore tell at all, dealt at
    // random rather than in turn, was too easy to lose a pod to blind at the full count.
    expect(zone().slice(0, 9).map((c) => c.largeSharkCount)).toEqual(levelLargeCounts.slice(0, 9));
    expect(zone()[9].largeSharkCount).toBe(levelLargeCounts[9] - 1);
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
    // Large sharks restart the deal at the pool's first entry, so every single-large level in the
    // dealt stretch fields a cookiecutter at 8 pod rather than a frilled at 12.
    for (const level of [13, 14, 15]) {
      const config = getLevelConfig(level);
      expect(config.largeSharkCount).toBe(1);
      expect(config.sharkKinds[0]).toBe('cookiecutter');
    }
    // The large frilled waits for 16, the first level with two, where the pool is drawn at random.
    expect(getLevelConfig(16).largeSharkCount).toBe(2);
    expect(getLevelConfig(16).dealKindsInTurn).toBeUndefined();
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

describe('dealLargeSharkKinds', () => {
  const TIGER_GW = ['tiger', 'greatWhite'] as const;
  const ALL = ['tiger', 'greatWhite', 'hammerhead'] as const;
  /** A draw that always lands on the great white in TIGER_GW, and on whatever sits at index 1. */
  const alwaysIndex1 = () => 0.5;

  const countGreatWhites = (kinds: readonly string[]): number => kinds.filter((k) => k === 'greatWhite').length;

  it('lets only one large great white through below the pair level', () => {
    const dealt = dealLargeSharkKinds(TIGER_GW, 3, GREAT_WHITE_PAIR_FROM_LEVEL - 1, false, () => 0.9);
    expect(dealt).toEqual(['greatWhite', 'tiger', 'tiger']);
  });

  it('stops capping from the pair level onwards', () => {
    const dealt = dealLargeSharkKinds(TIGER_GW, 3, GREAT_WHITE_PAIR_FROM_LEVEL, false, () => 0.9);
    expect(dealt).toEqual(['greatWhite', 'greatWhite', 'greatWhite']);
  });

  it('substitutes rather than drops, so the level keeps its large sharks', () => {
    for (const level of [4, 8, 9, 20]) {
      expect(dealLargeSharkKinds(ALL, 4, level, false, alwaysIndex1)).toHaveLength(4);
    }
  });

  it('swaps a capped great white for something else in the same pool', () => {
    const dealt = dealLargeSharkKinds(ALL, 3, 6, false, alwaysIndex1);
    expect(dealt[0]).toBe('greatWhite');
    expect(dealt.slice(1)).toEqual(['hammerhead', 'hammerhead']);
  });

  it('leaves a great white standing when the pool holds nothing else', () => {
    // A level of nothing but great whites is asking for them; the cap cannot be honoured.
    expect(dealLargeSharkKinds(['greatWhite'], 3, 5, false)).toEqual(['greatWhite', 'greatWhite', 'greatWhite']);
  });

  it('deals in turn from the first entry when the level asks it to', () => {
    expect(dealLargeSharkKinds(ALL, 3, 20, true)).toEqual(['tiger', 'greatWhite', 'hammerhead']);
  });

  it('keeps the cap while dealing in turn', () => {
    const dealt = dealLargeSharkKinds(TIGER_GW, 4, 5, true);
    expect(countGreatWhites(dealt)).toBe(1);
    expect(dealt).toHaveLength(4);
  });

  it('has nothing to deal from an empty pool', () => {
    expect(dealLargeSharkKinds([], 3, 5, false)).toEqual([]);
  });

  it('never pairs them on any authored level below the pair level, over many draws', () => {
    for (const config of LEVELS.filter((l) => l.level < GREAT_WHITE_PAIR_FROM_LEVEL)) {
      for (let attempt = 0; attempt < 400; attempt++) {
        const dealt = dealLargeSharkKinds(
          config.sharkKinds,
          config.largeSharkCount,
          config.level,
          config.dealKindsInTurn === true,
        );
        expect(dealt).toHaveLength(config.largeSharkCount);
        expect(countGreatWhites(dealt)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('largeKindPool', () => {
  const ALL = ['tiger', 'greatWhite', 'hammerhead'] as const;
  const none = new Set<SharkKind>();

  it('keeps only what the player has already met as a small shark', () => {
    const pool = largeKindPool(ALL, 6, new Set<SharkKind>(['tiger', 'greatWhite']), none);
    expect(pool).toEqual(['tiger', 'greatWhite']);
  });

  it('stops narrowing anything past the last gated level', () => {
    const pool = largeKindPool(ALL, SMALL_BEFORE_LARGE_UNTIL_LEVEL + 1, none, none);
    expect(pool).toEqual(ALL);
  });

  it('still gates on the last gated level itself', () => {
    const pool = largeKindPool(ALL, SMALL_BEFORE_LARGE_UNTIL_LEVEL, new Set<SharkKind>(['tiger']), none);
    expect(pool).toEqual(['tiger']);
  });

  it("falls back to this level's own smalls for a player with no history", () => {
    // Someone who bought their way straight to a depth: the large is at least swimming alongside
    // its own small version rather than arriving as the first of its kind they have ever seen.
    const pool = largeKindPool(ALL, 8, none, new Set<SharkKind>(['hammerhead']));
    expect(pool).toEqual(['hammerhead']);
  });

  it('prefers earlier levels over this one, so a species is small before it is large', () => {
    const pool = largeKindPool(ALL, 4, new Set<SharkKind>(['tiger']), new Set<SharkKind>(['tiger', 'greatWhite']));
    expect(pool).toEqual(['tiger']);
  });

  it('falls back to the whole pool rather than leaving a level without its large sharks', () => {
    expect(largeKindPool(ALL, 5, none, none)).toEqual(ALL);
  });
});

describe('a campaign played straight through', () => {
  /**
   * Walks levels 1-10 the way a player does, drawing each level's small sharks the way the game
   * does and carrying what was actually met forward, then checks the rule that matters: no large
   * shark of a species the player has not already seen a small one of.
   */
  const playThrough = (): { level: number; largeKinds: SharkKind[]; metBefore: SharkKind[] }[] => {
    const met = new Set<SharkKind>();
    const log: { level: number; largeKinds: SharkKind[]; metBefore: SharkKind[] }[] = [];
    for (const config of LEVELS) {
      const dealInTurn = config.dealKindsInTurn === true;
      const smallsHere = new Set<SharkKind>();
      for (let i = 0; i < config.normalSharkCount; i++) {
        smallsHere.add(
          dealInTurn
            ? config.sharkKinds[i % config.sharkKinds.length]
            : config.sharkKinds[Math.floor(Math.random() * config.sharkKinds.length)],
        );
      }
      const pool = largeKindPool(config.sharkKinds, config.level, met, smallsHere);
      const largeKinds = dealLargeSharkKinds(pool, config.largeSharkCount, config.level, dealInTurn);
      log.push({ level: config.level, largeKinds, metBefore: [...met] });
      for (const kind of smallsHere) met.add(kind);
    }
    return log;
  };

  it('never shows a large shark of a species not already met small, over many descents', () => {
    for (let run = 0; run < 200; run++) {
      for (const { level, largeKinds, metBefore } of playThrough()) {
        if (level > SMALL_BEFORE_LARGE_UNTIL_LEVEL) continue;
        for (const kind of largeKinds) {
          expect(metBefore).toContain(kind);
        }
      }
    }
  });

  it('keeps every level the number of large sharks it was authored with', () => {
    for (let run = 0; run < 50; run++) {
      const log = playThrough();
      expect(log.map((l) => l.largeKinds.length)).toEqual(LEVELS.map((c) => c.largeSharkCount));
    }
  });

  it('holds the great white to one a level below the pair level, all the way through', () => {
    for (let run = 0; run < 200; run++) {
      for (const { level, largeKinds } of playThrough()) {
        if (level >= GREAT_WHITE_PAIR_FROM_LEVEL) continue;
        expect(largeKinds.filter((k) => k === 'greatWhite').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('makes level 4s single large a tiger, since the great white is new that level', () => {
    for (let run = 0; run < 100; run++) {
      const level4 = playThrough().find((l) => l.level === 4)!;
      expect(level4.largeKinds).toEqual(['tiger']);
    }
  });
});

describe('the campaign against Endless, over the same ten levels', () => {
  const campaign = (level: number) => getLevelConfigForMode(level, 'campaign');
  const endless = (level: number) => getLevelConfigForMode(level, 'endless');

  it('leaves Endless exactly as the levels are authored', () => {
    for (const config of LEVELS) expect(endless(config.level)).toEqual(config);
  });

  it('is a large shark ahead of the baseline at 5, 7 and 9, and level with it everywhere else', () => {
    const ahead = [5, 7, 9];
    for (const config of LEVELS) {
      const gap = campaign(config.level).largeSharkCount - endless(config.level).largeSharkCount;
      expect(gap).toBe(ahead.includes(config.level) ? 1 : 0);
    }
  });

  it('never runs the campaign easier than Endless at the same depth', () => {
    for (const config of LEVELS) {
      expect(campaign(config.level).largeSharkCount).toBeGreaterThanOrEqual(endless(config.level).largeSharkCount);
    }
  });

  it('leaves the boss level identical in both modes', () => {
    const boss = LEVELS.find((c) => c.matriarch)!;
    expect(campaign(boss.level)).toEqual(endless(boss.level));
  });

  it('climbs without ever stepping back down', () => {
    const counts = LEVELS.map((c) => campaign(c.level).largeSharkCount);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });

  it('changes nothing else about the water', () => {
    for (let level = 1; level <= LEVELS.length; level++) {
      const { largeSharkCount: _c, ...campaignRest } = campaign(level);
      const { largeSharkCount: _e, ...endlessRest } = endless(level);
      expect(campaignRest).toEqual(endlessRest);
    }
  });

  it('runs the curve 0,0,1,1,2,2,3,3,4,4 against Endless 0,0,1,1,1,2,2,3,3,4', () => {
    const curve = (pick: (level: number) => { largeSharkCount: number }) =>
      LEVELS.map((c) => pick(c.level).largeSharkCount);
    expect(curve(endless)).toEqual([0, 0, 1, 1, 1, 2, 2, 3, 3, 4]);
    expect(curve(campaign)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    // The authored table and what the resolver actually hands out must not drift apart.
    expect(curve(campaign)).toEqual([...CAMPAIGN_LARGE_SHARK_COUNTS]);
  });

  it('stops at the end of the campaign, since past ten is Endless only', () => {
    for (const level of [LEVELS.length + 1, 15, 30]) {
      expect(campaign(level)).toEqual(getLevelConfig(level));
    }
  });

  it('leaves the shared baseline alone, so the Mesopelagic still mirrors it', () => {
    // The bump is applied over the authored config rather than written into it - if it were
    // written in, the zone that mirrors LEVELS would have quietly inherited it.
    expect(LEVELS.map((c) => c.largeSharkCount)).toEqual([0, 0, 1, 1, 1, 2, 2, 3, 3, 4]);
  });
});
