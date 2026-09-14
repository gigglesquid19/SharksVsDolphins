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
  /**
   * How dark this level is, 0 (full daylight, the default) to 1 (pitch black past the pod's own
   * light). Anything above 0 both dims the picture and cuts how far a shark can be seen from, so
   * at depth Echolocation stops being a convenience and becomes the only way to find anything.
   */
  gloom?: number;
  /**
   * Deal the level's species in turn rather than drawing each shark's kind at random.
   *
   * A random draw over a short pool can put none of one kind in front of you, which is fine on a
   * level whose pool is five deep and wrong on one whose whole point is introducing two species.
   * Note that the large sharks restart the deal, so the pool's order decides which kind the first
   * large is - see MESOPELAGIC_LEVELS.
   */
  dealKindsInTurn?: boolean;
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

/**
 * The level the speed ceiling is reached at: the last of the five depth zones, so the climb runs
 * the whole length of the authored descent and tops out exactly as the Hadal ends. Reaching the
 * cap earlier left the back half of the zones playing identically to each other.
 */
export const SHARK_SPEED_CAP_LEVEL = ENDLESS_BACKGROUND_COUNT;

/** Where the climb starts: whatever the campaign's last level runs at. */
const ENDLESS_BASE_SHARK_SPEED = LEVELS[LEVELS.length - 1].sharkSpeedMultiplier;

/**
 * Per-level speed increase, derived rather than written down, so the ceiling and the level it is
 * reached at stay the two numbers that decide the curve. Currently 0.018 a level, against the
 * 0.03 it used to climb at.
 */
const SHARK_SPEED_PER_LEVEL =
  (MAX_ENDLESS_SHARK_SPEED - ENDLESS_BASE_SHARK_SPEED) / (SHARK_SPEED_CAP_LEVEL - LEVELS.length);

/**
 * Test sandboxes: the level that opens the Bathypelagic and the Abyssopelagic is stripped back to
 * one species at a time, so a new shark can be watched on its own instead of being picked out of
 * water already full of tigers.
 *
 * Everything else about the level is untouched - the depth, the artwork, the pod limit and the
 * speed modifier all stay - so a shark put in here moves exactly as it would in a real descent.
 * The override is a partial config rather than a flag for that reason: trying a new kind out is a
 * matter of writing it in here, and the shark-intro card fires for it because the kind has not
 * been seen this run.
 *
 * Each one is dark, as its depth really would be. Level 31 is still empty, ready for the next
 * design; a level holding no sharks cannot be cleared, because the level-complete check only
 * runs when a shark dies, so a run that reaches it stays there until the player quits.
 *
 * Level 11 used to be one of these. It is an authored level now - see MESOPELAGIC_LEVELS - so the
 * bench for whatever comes next is 21, and 31 after it.
 */
export const SANDBOX_LEVELS: Record<number, Partial<LevelConfig>> = {
  21: { sharkKinds: ['cookiecutter'], normalSharkCount: 4, largeSharkCount: 0, matriarch: false, gloom: 0.8, dealKindsInTurn: true },
  31: { sharkKinds: [], normalSharkCount: 0, largeSharkCount: 0, matriarch: false, gloom: 0.9, dealKindsInTurn: true },
};

/**
 * The Mesopelagic, levels 11-20, authored rather than scaled.
 *
 * Past the campaign every level was the same three shallow-water species in slowly growing
 * numbers, so the two deep-water sharks existed only on a test bench and the zone that should
 * have introduced them never did. These ten run the curve levels 1-10 run - the same counts
 * (4,5,5,6,6,7,7,8,8,9 small against 0,0,1,1,2,2,3,3,4,4 large), a new species folded in twice
 * along the way, and a Matriarch at the end - but starting from the frilled shark and the
 * cookiecutter rather than from tigers.
 *
 * 11-15 are those two alone, dealt in turn so both are always in the water: a random draw over a
 * two-deep pool can hand you four of one kind, which is no way to introduce either. From 16 the
 * shallow-water sharks come back a species at a time - the hammerhead at 16, the great white at
 * 19 - and the pool is deep enough that a random draw stays varied on its own. The tiger does not
 * come back at all; see MESO_CC_FRILLED for why.
 *
 * The pool's order carries weight. Large sharks restart the deal at the first entry, so listing
 * the cookiecutter first means the single large at 13 and 14 is a large cookiecutter at 8 pod,
 * and the large frilled - 12 pod, against a cap of 15 - only arrives at 15, where there are two
 * larges and the player has had two levels of warning.
 *
 * These are partial configs merged over the endless curve, like the sandboxes, so speed keeps
 * climbing on the same derived line as every level past them rather than forking its own.
 */
/**
 * No tigers down here.
 *
 * The shallow-water species carry no photophores, so in water this dark they arrive with no tell
 * at all - and a tiger is the one that cloaks on top of that, which made it a shark you could
 * neither see nor anticipate. Losing it costs the zone nothing: the hammerhead covers the same
 * role of a fast shallow-water shark coming back to trouble a build, and does it while being
 * something you can at least watch for.
 */
const MESO_CC_FRILLED: SharkKind[] = ['cookiecutter', 'frilled'];
const MESO_PLUS_HAMMER: SharkKind[] = ['cookiecutter', 'frilled', 'hammerhead'];
const MESO_ALL: SharkKind[] = ['cookiecutter', 'frilled', 'hammerhead', 'greatWhite'];

/**
 * Gloom climbs 0.35 -> 0.62 across the zone, a step of 0.03 a level. Level 10 ends in daylight,
 * so opening at the 0.62 the bench used to sit at was a wall; eased in, the water closes over the
 * descent, and the photophores go from a curiosity to the only way to track what is hunting you.
 */
const MESO_GLOOM_AT_11 = 0.35;
const MESO_GLOOM_PER_LEVEL = 0.03;
const mesoGloom = (level: number): number =>
  Math.round((MESO_GLOOM_AT_11 + (level - 11) * MESO_GLOOM_PER_LEVEL) * 100) / 100;

/** Held flat across the zone, so the curve is shark counts and darkness rather than pod growth. */
const MESO_POD_LIMIT = 15;

export const MESOPELAGIC_LEVELS: Record<number, Partial<LevelConfig>> = {
  11: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 4, largeSharkCount: 0, dealKindsInTurn: true },
  12: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 5, largeSharkCount: 0, dealKindsInTurn: true },
  13: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 5, largeSharkCount: 1, dealKindsInTurn: true },
  14: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 6, largeSharkCount: 1, dealKindsInTurn: true },
  15: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 6, largeSharkCount: 2, dealKindsInTurn: true },
  16: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 7, largeSharkCount: 2 },
  17: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 7, largeSharkCount: 3 },
  18: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 8, largeSharkCount: 3 },
  19: { sharkKinds: MESO_ALL, normalSharkCount: 8, largeSharkCount: 4 },
  20: { sharkKinds: MESO_ALL, normalSharkCount: 9, largeSharkCount: 4 },
};

/** Whether this depth is one of the ten authored Mesopelagic levels. */
export function isMesopelagicLevel(level: number): boolean {
  return Math.floor(level) in MESOPELAGIC_LEVELS;
}

/** Whether this depth is a bench for trying sharks out rather than a level meant to be fought through. */
export function isSandboxLevel(level: number): boolean {
  return Math.floor(level) in SANDBOX_LEVELS;
}

export function getEndlessLevelConfig(level: number): LevelConfig {
  const over = level - LEVELS.length;
  const base: LevelConfig = {
    level,
    sharkKinds: ALL_KINDS,
    normalSharkCount: Math.min(9 + Math.ceil(over / 3), 16),
    largeSharkCount: Math.min(4 + Math.ceil(over / 3), 10),
    maxDolphins: Math.min(15 + Math.floor(over / 4), 20),
    sharkSpeedMultiplier: Math.min(
      ENDLESS_BASE_SHARK_SPEED + over * SHARK_SPEED_PER_LEVEL,
      MAX_ENDLESS_SHARK_SPEED,
    ),
    matriarch: over % 10 === 0,
  };
  const depth = Math.floor(level);
  if (isSandboxLevel(level)) return { ...base, ...SANDBOX_LEVELS[depth] };
  if (isMesopelagicLevel(level)) {
    // matriarch and sharkSpeedMultiplier are left to the endless curve: level 20 is every tenth
    // level, so it gets its boss from the same rule that gives 30 and 40 theirs.
    return { ...base, ...MESOPELAGIC_LEVELS[depth], maxDolphins: MESO_POD_LIMIT, gloom: mesoGloom(depth) };
  }
  return base;
}

/** Resolves the config for any level: campaign levels 1-10 as authored, beyond that endless scaling. */
export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= LEVELS.length) return LEVELS[level - 1];
  return getEndlessLevelConfig(level);
}
