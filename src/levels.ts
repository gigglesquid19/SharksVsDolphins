import type { SharkKind } from './sprites';

/**
 * Note: the pod size needed to ram a shark is NOT configured per level - it comes from
 * Game.sharkPodRequirement(), which is per shark kind and size (large: tiger 8, hammerhead 10,
 * great white 12). This interface used to carry a `largeSharkPodRequirement` per level that
 * nothing ever read, so those numbers silently did nothing; it has been removed rather than
 * left here implying a level-based difficulty curve that was not in effect.
 */
export interface LevelConfig {
  level: number;
  sharkKinds: SharkKind[];
  normalSharkCount: number;
  largeSharkCount: number;
  maxDolphins: number;
  sharkSpeedMultiplier: number;
  matriarch?: boolean;
}

const TIGER: SharkKind[] = ['tiger'];
const TIGER_GREAT_WHITE: SharkKind[] = ['tiger', 'greatWhite'];
const ALL_KINDS: SharkKind[] = ['tiger', 'greatWhite', 'hammerhead'];

export const LEVELS: LevelConfig[] = [
  { level: 1, sharkKinds: TIGER, normalSharkCount: 4, largeSharkCount: 0, maxDolphins: 8, sharkSpeedMultiplier: 1.0 },
  { level: 2, sharkKinds: TIGER, normalSharkCount: 5, largeSharkCount: 0, maxDolphins: 8, sharkSpeedMultiplier: 1.03 },
  { level: 3, sharkKinds: TIGER, normalSharkCount: 5, largeSharkCount: 1, maxDolphins: 10, sharkSpeedMultiplier: 1.06 },
  { level: 4, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 6, largeSharkCount: 1, maxDolphins: 12, sharkSpeedMultiplier: 1.09 },
  { level: 5, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 6, largeSharkCount: 2, maxDolphins: 12, sharkSpeedMultiplier: 1.12 },
  { level: 6, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 2, maxDolphins: 12, sharkSpeedMultiplier: 1.15 },
  { level: 7, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 3, maxDolphins: 12, sharkSpeedMultiplier: 1.18 },
  { level: 8, sharkKinds: ALL_KINDS, normalSharkCount: 8, largeSharkCount: 3, maxDolphins: 13, sharkSpeedMultiplier: 1.21 },
  { level: 9, sharkKinds: ALL_KINDS, normalSharkCount: 8, largeSharkCount: 4, maxDolphins: 14, sharkSpeedMultiplier: 1.24 },
  { level: 10, sharkKinds: ALL_KINDS, normalSharkCount: 9, largeSharkCount: 4, maxDolphins: 15, sharkSpeedMultiplier: 1.27, matriarch: true }
];

/**
 * How many distinct backgrounds Endless has before it starts repeating. They run in five depth
 * zones of ten - Eutrophic, Mesopelagic, Bathypelagic, Abyssopelagic, Hadal - so the water gets
 * visibly deeper and stranger the further a run goes, which is the only progression Endless has
 * past the difficulty curve.
 */
export const ENDLESS_BACKGROUND_COUNT = 50;

/**
 * Campaign and Endless draw from separate sets. The campaign's ten are unchanged and shared with
 * nothing; Endless has its own fifty, and past level 50 it cycles them rather than running out.
 */
/**
 * The Depthless Campaign's five depth zones, ten levels each. Entering the first level of a zone
 * and clearing its last one are both announced, which is what gives a run past the campaign a
 * sense of going somewhere rather than just counting upwards.
 *
 * The names run in the real ocean's order and the depths are continuous - each zone starts
 * where the last one ended, so a player reading the cards can add them up. The figures are the
 * game's own rather than a textbook's: the real bands are nothing like this even, and the real
 * Hadal does not begin until 6000m.
 */
export interface DepthZone {
  /** Bare name, with no "Zone" on it - the announcements add that, so every zone reads the same
   *  way ("Entered the Hadal Zone", "Hadal Zone Liberated") whatever it is called. */
  name: string;
  /** Depth range, shown under the zone name on entry. */
  depth: string;
  firstLevel: number;
  lastLevel: number;
}

export const DEPTH_ZONES: DepthZone[] = [
  { name: 'Eutrophic', depth: '0m - 200m', firstLevel: 1, lastLevel: 10 },
  { name: 'Mesopelagic', depth: '200m - 1000m', firstLevel: 11, lastLevel: 20 },
  { name: 'Bathypelagic', depth: '1000m - 2000m', firstLevel: 21, lastLevel: 30 },
  { name: 'Abyssopelagic', depth: '2000m - 4000m', firstLevel: 31, lastLevel: 40 },
  { name: 'Hadal', depth: '4000m+', firstLevel: 41, lastLevel: 50 },
];

/**
 * The zone a level sits in. Past level 50 a run stays in the Hadal: the backgrounds cycle, but
 * announcing a return to the sunlit shallows at level 51 would undo the whole descent.
 */
export function zoneForLevel(level: number): DepthZone {
  const last = DEPTH_ZONES[DEPTH_ZONES.length - 1];
  if (level >= last.firstLevel) return last;
  return DEPTH_ZONES.find((z) => level >= z.firstLevel && level <= z.lastLevel) ?? DEPTH_ZONES[0];
}

/** The zone this level opens, if it is the first of one. Null past level 50 - no new zones there. */
export function zoneEnteredAt(level: number): DepthZone | null {
  return DEPTH_ZONES.find((z) => z.firstLevel === level) ?? null;
}

/** 1-based position of a zone in the descent: 1 is the Eutrophic, 5 the Hadal. */
export function zoneNumber(zone: DepthZone): number {
  return DEPTH_ZONES.indexOf(zone) + 1;
}

/** The zone this level completes, if it is the last of one. Null past level 50. */
export function zoneClearedAt(level: number): DepthZone | null {
  return DEPTH_ZONES.find((z) => z.lastLevel === level) ?? null;
}

export function getLevelBackground(level: number, mode: 'campaign' | 'endless' = 'campaign'): string {
  // BASE_URL is '/' for the app / dev and '/SharksVsDolphins/' on GitHub Pages.
  const base = import.meta.env.BASE_URL;
  if (mode === 'endless') {
    const bgIndex = ((level - 1) % ENDLESS_BACKGROUND_COUNT) + 1;
    return `${base}levels/endless/${bgIndex}.webp`;
  }
  const bgIndex = ((level - 1) % LEVELS.length) + 1;
  return `${base}levels/${bgIndex}.webp`;
}

/**
 * Endless-mode scaling past the 10-level campaign: shark counts and max pod
 * size grow then cap out so late levels stay playable, and speed now caps too - see
 * MAX_ENDLESS_SHARK_SPEED. The matriarch reappears every 10 levels
 * as a recurring boss beat; unlike the campaign, she flees wounded instead
 * of being destroyed (see Game.fleeMatriarch), so the same cycle repeats
 * indefinitely rather than ending the run.
 */
/**
 * Ceiling on the per-level shark speed modifier in the Depthless Campaign. Speed used to climb
 * without limit, which is what used to end a run: past a point the sharks simply outran the pod
 * and no amount of play could hold them off. Capped, the late game is decided by the number of
 * sharks in the water rather than by a speed nothing can answer.
 *
 * This caps the level modifier, not a shark's final speed - a hammerhead still carries its 1.15
 * and a large great white its 1.25 on top, because those are what those animals are.
 */
export const MAX_ENDLESS_SHARK_SPEED = 2;

export function getEndlessLevelConfig(level: number): LevelConfig {
  const over = level - LEVELS.length;
  return {
    level,
    sharkKinds: ALL_KINDS,
    normalSharkCount: Math.min(9 + Math.ceil(over / 3), 16),
    largeSharkCount: Math.min(4 + Math.ceil(over / 3), 10),
    maxDolphins: Math.min(15 + Math.floor(over / 4), 20),
    sharkSpeedMultiplier: Math.min(1.27 + over * 0.03, MAX_ENDLESS_SHARK_SPEED),
    matriarch: over % 10 === 0,
  };
}

/** Resolves the config for any level: campaign levels 1-10 as authored, beyond that endless scaling. */
export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= LEVELS.length) return LEVELS[level - 1];
  return getEndlessLevelConfig(level);
}
