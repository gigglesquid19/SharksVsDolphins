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
  { level: 1, sharkKinds: TIGER, normalSharkCount: 3, largeSharkCount: 0, maxDolphins: 8, sharkSpeedMultiplier: 1.0 },
  { level: 2, sharkKinds: TIGER, normalSharkCount: 4, largeSharkCount: 0, maxDolphins: 8, sharkSpeedMultiplier: 1.03 },
  { level: 3, sharkKinds: TIGER, normalSharkCount: 4, largeSharkCount: 1, maxDolphins: 10, sharkSpeedMultiplier: 1.06 },
  { level: 4, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 5, largeSharkCount: 1, maxDolphins: 12, sharkSpeedMultiplier: 1.09 },
  { level: 5, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 5, largeSharkCount: 1, maxDolphins: 12, sharkSpeedMultiplier: 1.12 },
  { level: 6, sharkKinds: ALL_KINDS, normalSharkCount: 6, largeSharkCount: 2, maxDolphins: 12, sharkSpeedMultiplier: 1.15 },
  { level: 7, sharkKinds: ALL_KINDS, normalSharkCount: 6, largeSharkCount: 2, maxDolphins: 12, sharkSpeedMultiplier: 1.18 },
  { level: 8, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 3, maxDolphins: 13, sharkSpeedMultiplier: 1.21 },
  { level: 9, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 3, maxDolphins: 14, sharkSpeedMultiplier: 1.24 },
  { level: 10, sharkKinds: ALL_KINDS, normalSharkCount: 8, largeSharkCount: 4, maxDolphins: 15, sharkSpeedMultiplier: 1.27, matriarch: true }
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
  // The same water level 11 opens with, so the deep events can be watched against a shark mix
  // that is already understood rather than against a new one at the same time.
  21: { sharkKinds: ['cookiecutter', 'frilled'], normalSharkCount: 3, largeSharkCount: 0, matriarch: false, gloom: 0.8, dealKindsInTurn: true },
  31: { sharkKinds: [], normalSharkCount: 0, largeSharkCount: 0, matriarch: false, gloom: 0.9, dealKindsInTurn: true },
};

/**
 * The Mesopelagic, levels 11-20, authored rather than scaled.
 *
 * Past the campaign every level was the same three shallow-water species in slowly growing
 * numbers, so the two deep-water sharks existed only on a test bench and the zone that should
 * have introduced them never did. These ten run the curve levels 1-10 run - the same counts
 * (3,4,4,5,5,6,6,7,7,8 small against 0,0,1,1,1,2,2,3,3,4 large), a new species folded in twice
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
 * the cookiecutter first means the single large on 13, 14 and 15 is a large cookiecutter at 8 pod
 * rather than a large frilled at 12, against a pod capped at 15.
 *
 * That does mean the large frilled now waits for 16, where it is one of two larges drawn at
 * random rather than dealt - so it is no longer guaranteed an introduction of its own. The three
 * single-large levels match the campaign's own run of three, which is the curve this zone is
 * built to mirror, and the mirror was judged worth more than the guarantee.
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
  11: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 3, largeSharkCount: 0, dealKindsInTurn: true },
  12: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 4, largeSharkCount: 0, dealKindsInTurn: true },
  13: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 4, largeSharkCount: 1, dealKindsInTurn: true },
  14: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 5, largeSharkCount: 1, dealKindsInTurn: true },
  15: { sharkKinds: MESO_CC_FRILLED, normalSharkCount: 5, largeSharkCount: 1, dealKindsInTurn: true },
  16: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 6, largeSharkCount: 2 },
  17: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 6, largeSharkCount: 2 },
  18: { sharkKinds: MESO_PLUS_HAMMER, normalSharkCount: 7, largeSharkCount: 3 },
  19: { sharkKinds: MESO_ALL, normalSharkCount: 7, largeSharkCount: 3 },
  20: { sharkKinds: MESO_ALL, normalSharkCount: 8, largeSharkCount: 4 },
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
    normalSharkCount: Math.min(8 + Math.ceil(over / 3), 15),
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

/**
 * The first campaign level that runs harder than the same-numbered level in Endless, and by how
 * much.
 *
 * The two modes share levels 1-10 but not what the player brings to them. The campaign hands out
 * a Mega Shrimp pick after every level it clears - vitality, speed, charisma or boost - so by
 * level 5 a campaign pod is several upgrades deep, while an Endless run at level 5 is still on
 * whatever the Store sold it before the run began and gets nothing further. The same water is
 * therefore not the same fight, and identical numbers made the campaign the easier of the two
 * exactly where it was supposed to be building.
 *
 * One extra large shark from 5 on, applied on top of the authored config rather than written into
 * it, so LEVELS stays the shared baseline that Endless and the Mesopelagic's mirror both read.
 *
 * The boss level is left out, and by its own flag rather than by number. Level 10 is a fight
 * about the Matriarch: she summons great whites of her own as it runs, so the escort count is
 * already only half of what is in the water, and a mode that arrived there better equipped does
 * not need the arena stacked as well. Any boss level added later is covered without this having
 * to be remembered.
 */
export const CAMPAIGN_HARDER_FROM_LEVEL = 5;
export const CAMPAIGN_EXTRA_LARGE_SHARKS = 1;

/**
 * A level as the given mode should actually play it.
 *
 * Everything that builds a level to be played goes through here; everything that only wants to
 * know what a depth *is* - which music it plays, whether it holds a Matriarch, what the Depthless
 * level-select card should say - can keep reading getLevelConfig, since the campaign's extra
 * shark changes none of that.
 */
export function getLevelConfigForMode(level: number, mode: 'campaign' | 'endless'): LevelConfig {
  const config = getLevelConfig(level);
  if (mode !== 'campaign') return config;
  if (level < CAMPAIGN_HARDER_FROM_LEVEL || level > LEVELS.length) return config;
  if (config.matriarch) return config;
  return { ...config, largeSharkCount: config.largeSharkCount + CAMPAIGN_EXTRA_LARGE_SHARKS };
}

/**
 * The first level allowed to field more than one large great white at a time.
 *
 * A large great white asks for a pod of ten (twelve past level 5 - see Game.sharkPodRequirement),
 * and the early levels cap the pod at twelve. Two of them at once is therefore not twice the
 * problem but a different one: the whole pod is committed to the first while the second hunts it,
 * and there is no second pod to answer with. The species is meant to be the thing that teaches
 * you to commit a Boost dash, and it cannot teach that while you are being asked to be in two
 * places at once.
 *
 * Levels 5 to 8 are where this actually bit: two or three larges drawn at random from a pool with
 * the great white in it. From 9 the pod is big enough, and the player practised enough, for a pair
 * to be a difficulty step rather than a wall.
 */
export const GREAT_WHITE_PAIR_FROM_LEVEL = 9;

/**
 * Picks the kinds for a level's large sharks, holding the great white to one below
 * GREAT_WHITE_PAIR_FROM_LEVEL.
 *
 * The deal starts over at the first entry of the pool, which is what makes the pool's *order*
 * matter for the large sharks - see MESOPELAGIC_LEVELS. Levels with `dealKindsInTurn` take their
 * kinds in turn; everything else draws at random.
 *
 * A capped great white is swapped for something else in the same pool rather than dropped, so the
 * level keeps the number of large sharks it was authored with. If the pool holds nothing else the
 * cap cannot be honoured and the great white stands: a level of nothing but great whites is asking
 * for them.
 *
 * `roll` is injectable so the draw can be tested.
 */
export function dealLargeSharkKinds(
  kinds: readonly SharkKind[],
  count: number,
  level: number,
  dealInTurn: boolean,
  roll: () => number = Math.random,
): SharkKind[] {
  if (kinds.length === 0) return [];
  const limit = level >= GREAT_WHITE_PAIR_FROM_LEVEL ? Infinity : 1;
  const others = kinds.filter((k) => k !== 'greatWhite');
  const out: SharkKind[] = [];
  let greatWhites = 0;

  for (let i = 0; i < count; i++) {
    const draw = (pool: readonly SharkKind[]): SharkKind =>
      dealInTurn ? pool[i % pool.length] : pool[Math.floor(roll() * pool.length)];
    let kind = draw(kinds);
    if (kind === 'greatWhite' && greatWhites >= limit && others.length > 0) kind = draw(others);
    if (kind === 'greatWhite') greatWhites += 1;
    out.push(kind);
  }
  return out;
}

/**
 * The last level on which a large shark has to have been met as a small one first.
 *
 * A large shark is the same animal with a different answer: it needs a pod half again the size
 * and a Boost dash on top, and the only way a player knows which of those two things is swimming
 * at them is by having learned the silhouette. Meeting a species for the first time at its large
 * size teaches the silhouette and the punishment in the same moment, which is how a level stops
 * being difficult and starts being unfair.
 *
 * Past this the campaign has shown every shallow-water species in both sizes, and the boss level
 * is allowed to field whatever it likes.
 */
export const SMALL_BEFORE_LARGE_UNTIL_LEVEL = 9;

/**
 * Narrows a level's pool to the kinds its large sharks are allowed to be.
 *
 * `metAsSmall` is what the run has already put in front of the player as a small shark on an
 * earlier level; `smallsHere` is what this level's own small sharks turned out to be, which is
 * settled before the large ones are dealt.
 *
 * Earlier levels are preferred, so in an ordinary descent a species is always a small shark
 * before it is ever a large one - the great white arrives small on 4 and can only be large from
 * 5, the hammerhead small on 6 and large from 7. Falling back to this level's own smalls covers
 * the player who bought their way straight to a depth and has no history at all: the large is
 * then at least swimming alongside its own small version rather than arriving alone.
 *
 * Falling back to the whole pool is the last resort, for a level whose small sharks happen to
 * share none of its kinds - better a large shark than no large shark on a level authored for one.
 */
export function largeKindPool(
  kinds: readonly SharkKind[],
  level: number,
  metAsSmall: ReadonlySet<SharkKind>,
  smallsHere: ReadonlySet<SharkKind>,
): readonly SharkKind[] {
  if (level > SMALL_BEFORE_LARGE_UNTIL_LEVEL) return kinds;
  const taught = kinds.filter((k) => metAsSmall.has(k));
  if (taught.length > 0) return taught;
  const here = kinds.filter((k) => smallsHere.has(k));
  return here.length > 0 ? here : kinds;
}
