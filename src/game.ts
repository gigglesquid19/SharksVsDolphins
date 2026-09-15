import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Sprite,
  Assets,
} from 'pixi.js';
import { ParticleSystem } from './particles';
import {
  createDolphinSprite,
  createEyes,
  createJellyfishSprite,
  DEEP_JELLYFISH,
  jellyfishFlashAlpha,
  SHALLOW_JELLYFISH,
  createPhotophores,
  createSharkSprite,
  makeDolphinBodyCanvas,
  makeRadialGradientTexture,
  drawTentacle,
  drawTentacleLights,
  makeVignetteTexture,
  photophoreFlashAlpha,
  photophorePulseAlpha,
  sliceSharkStrip,
  SharkFishSprite,
  Photophore,
  SharkKind,
  SharkTextureSet,
  VIGNETTE_CLEAR_FRACTION,
} from './sprites';
import { sfx } from './sfx';
import { recordEncounter, recordSharkEncounter } from './sharkopedia';
import { HUNTING_MODE_POD_SIZE, podRequirement } from './sharks';
import {
  LEVELS,
  LevelConfig,
  dealLargeSharkKinds,
  getLevelBackground,
  largeKindPool,
  getLevelConfig,
  getLevelConfigForMode,
  isMesopelagicLevel,
  isSandboxLevel,
  zoneClearedAt,
  zoneEnteredAt,
  zoneNumber,
} from './levels';
import { CANVAS_H, CANVAS_W, SIZE_X, SIZE_Y, WORLD_SCALE } from './constants';
import { clampEntityY, directionDelta, sweptDistance, wrapX } from './utils';
import { Dolphin, Shark, Jellyfish, Megamouth, Tentacle } from './entities';
import type { ConsumableId, Inventory } from './inventory';
import { getInventory, magicShrimpHeld, useConsumable } from './inventory';
import {
  loadCampaignScores,
  loadEndlessScores,
  saveCampaignScore,
  saveEndlessScore,
  NewCampaignScore,
  NewEndlessScore,
} from './scoring';
import { RunCheckpoint, clearRunCheckpoint, saveRunCheckpoint } from './runState';
import { hasSeenHint, markHintSeen, HintId } from './tutorialHints';
import { AMBIENT_TRACKS, BOSS_TRACKS, pickRandomTrack } from './music';
import { ACHIEVEMENTS, AchievementId, getUnlockedMap, unlock } from './achievements';
import { bumpLifetime, recordPlayDay } from './lifetimeStats';
import {
  awardPearls,
  getPearls,
  pearlsForLevel,
  pearlsForZoneClear,
  PEARLS_CAMPAIGN_CLEAR,
  PEARLS_FLAWLESS_CAMPAIGN_BONUS,
} from './pearls';
import { getDolphinName } from './profile';
import { IRON_SKIN_UNLOCK_LEVEL, baseEcholocationStats, developerModeActive, echolocationStats, endlessStartBonuses, equippedSkinId, grantSkin, ownsEcholocation, ownsIronSkin, ownsSkin } from './store';
import { markCampaignCleared, markLevelCleared } from './progress';
import { hasLevelAccess, startLevelIsRanked } from './levelAccess';
import { skinById } from './skins';
import { shareMilestone, SHARE_REWARD_SKIN } from './share';
import { playGames } from './playGames';
import { isAndroid } from './platform';
import { ads } from './ads';
import { iap } from './iap';

/**
 * The second mode is shown to the player as the **Depthless Campaign**; the id stays 'endless'
 * because it is written into saved leaderboard entries, the run checkpoint and the Store's
 * persisted upgrades. Renaming it would orphan every existing player's scores and purchases for
 * the sake of a label, so the display name lives in the markup and the code keeps the old id.
 */
export type GameMode = 'campaign' | 'endless';
type LeaderboardBoard = 'campaign' | 'endless';

// '/' for the app and dev, '/SharksVsDolphins/' for the GitHub Pages build - so
// public/ assets loaded at runtime resolve under whatever sub-path is in use.
const ASSET_BASE = import.meta.env.BASE_URL;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const DOLPHIN_SPAWN_INTERVAL = 12;
/**
 * How long a shark has to wait after taking a dolphin before it can take another.
 *
 * There is a one-second floor on the pod as a whole - no hazard can strip it faster than that -
 * but that was the only limit, so a single shark that got inside the pod and stayed there fed
 * once a second for as long as it was there. Four seconds a shark makes the same contact a thing
 * that costs you one dolphin and a moment to recover, rather than the pod. It does not make the
 * shark any less dangerous to be near: it keeps hunting throughout, and every other shark in the
 * water is still on its own clock.
 */
const SHARK_FEED_COOLDOWN_MS = 4000;
/**
 * What that interval becomes with developer mode on: a couple of seconds off the ordinary 12, so
 * a pod comes together fast enough to actually get at the deep levels' sharks.
 *
 * A frilled shark asks for seven dolphins and a large one twelve, against a cap of fifteen, so
 * at the stock rate most of a testing run is spent waiting for a pod rather than using it. It
 * also pins the number: level 10 otherwise halves the interval on its own, which would leave the
 * one level most worth testing spawning on a different clock from every other.
 */
const DEV_DOLPHIN_SPAWN_INTERVAL = 10;
const EVENT_CHECK_INTERVAL = 60;
const EVENT_CHANCE = 0.1;
const EVENT_DURATION = 30;
/**
 * The Mesopelagic's one megamouth, and where in the zone it turns up.
 *
 * It is not weather any more. A creature that has to be beaten before the level will end is a
 * set piece, and a set piece that can happen twice in a descent - or not at all - is neither
 * rare nor reliable. One is rolled onto a level somewhere in the zone at the start of a run, and
 * once it has been fought that is the run's encounter spent.
 *
 * Forty-five seconds in, rather than on the ordinary minute, so the level is properly under way
 * but nowhere near finished: it has to arrive while there are still sharks in the water, because
 * everything interesting about it is what happens when there are not.
 */
const MEGAMOUTH_ENCOUNTER_FIRST_LEVEL = 11;
const MEGAMOUTH_ENCOUNTER_LAST_LEVEL = 19;
const MEGAMOUTH_ENCOUNTER_AT = 45;
const JELLYFISH_SWARM_DURATION = 45;
/**
 * How the swarm ends early, once it has actually gone by.
 *
 * Forty-five seconds is how long it takes the slowest jellyfish to cross an empty arena, and that
 * is the wrong thing to hold the player to. A swarm is a wall to be got through, and once the pod
 * is through it the level is simply paused: the sharks do not hunt during a swarm, so what is
 * left is half a minute of watching stragglers drift off an empty screen.
 *
 * The pod counts as through when every remaining jellyfish is behind it - they only ever drift
 * one way, so this cannot be true at the start, when they spawn off the right-hand edge ahead of
 * everybody. Hold that for a few seconds and the rest hurry off and the event closes. The margin
 * is what "comfortably" means: a jellyfish a body length behind you is not yet behind you.
 */
const SWARM_CLEAR_MARGIN = 12;
const SWARM_CLEAR_SECONDS = 6;
/** How much faster the stragglers leave once the pod is clear of them. */
const SWARM_CLEAR_SPEEDUP = 3;
/** The deepest level a jellyfish swarm can appear at; boss levels are excluded separately. */
const JELLYFISH_MAX_LEVEL = 19;

/**
 * The kraken: arms reaching in from the sides on their own cycles.
 *
 * Each arm telegraphs before it can hurt anyone, so what the player reads is which rows are about
 * to close rather than where a tentacle happens to be. The phases are deliberately slower than a
 * shark's strike - this is the arena narrowing, not something lunging, and the counterplay is
 * choosing a lane early rather than reacting late.
 */
/**
 * On a test bench the deep events are dealt in turn and soon, rather than rolled for.
 *
 * The same reasoning the bench already applies to shark species: a one-in-five roll every sixty
 * seconds is fine for a level being played and useless for one being tested on, where the whole
 * point is to see the thing you came to look at. Both events are guaranteed, one after the other,
 * with the first arriving a few seconds in.
 */
const BENCH_FIRST_EVENT_AT = 12;
/**
 * Longer than the kraken lasts, deliberately, and then some.
 *
 * updateEvents returns early while an event is running, so a warning due during one is never
 * given - the next event would simply appear. At 28 seconds of kraken from a start at 12 the gap
 * has to clear 40 seconds with five to spare for the warning, or the megamouth arrives
 * unannounced and the bench fails to demonstrate the one thing worth checking about it.
 *
 * It sits well past that floor at 110, which is about frequency rather than about the warning:
 * the bench alternates the two deep events, so the gap between krakens is twice this, and at 50
 * that was one every hundred seconds - the cadence that made them feel constant in a playtest.
 * The megamouth is also skipped whenever an undefeated one is still in the water, and every
 * skipped turn used to mean the next thing to fire was another kraken.
 */
const BENCH_EVENT_INTERVAL = 110;
const BENCH_EVENT_ORDER: GameEventType[] = ['kraken', 'megamouth'];

/**
 * How long the arms are out, in seconds. Down 30% from the 40 it opened at.
 *
 * The arena is at its most closed for this whole stretch: the sharks are gone, the dolphin spawns
 * are held, and two of the three lanes are shutting and reopening on their own clocks. Forty
 * seconds of that is long enough for the tension to flatten into waiting - the shape of it is
 * read in the first few reaches and the rest is the same shape again. At 28 each arm still gets
 * four to six reaches, so nothing about the pattern is lost; it simply stops before it repeats.
 */
const KRAKEN_DURATION = 28;
const KRAKEN_ARMS = 3;
const TENTACLE_TELEGRAPH_MS = 600;
const TENTACLE_REACH_MS = 1200;
const TENTACLE_HOLD_MS = 800;
const TENTACLE_WITHDRAW_MS = 1000;
/** Longest wait between one arm withdrawing and reaching again, so the arena is never fully shut. */
const TENTACLE_WAIT_MS = 2600;
/** How far across a single arm can get, as a share of the arena's width. */
const TENTACLE_REACH_SHARE = 0.675;
/**
 * How close to the arm counts as contact, in world units.
 *
 * Tied to how thick the arm is drawn: TENTACLE_ROOT_WIDTH over WORLD_SCALE is six world units at
 * the root, and this sits just inside that. It has to move whenever the drawn thickness does, or
 * the arm starts taking dolphins it visibly missed - or worse, missing ones it visibly hit.
 */
const TENTACLE_HIT_RADIUS = 4.8;
/** Clearance kept from the top and bottom when an arm picks a new row to come back at. */
const TENTACLE_EDGE_MARGIN = 8;
/** How fast a shark leaves, and comes back, against its own speed. Faster than it hunts. */
const KRAKEN_FLIGHT_SPEED = 2.4;
/** How far past the edge counts as gone, in world units. */
const KRAKEN_OFFSTAGE_MARGIN = 16;

/**
 * The megamouth: a filter feeder that crosses the arena and ignores everyone in it.
 *
 * Twice the size of a large great white, black, and lit only by its own photophores - so what the
 * player sees coming is a row of lights, the same read the deep-water sharks taught them, on
 * something far too big to ram. It never steers: the danger is entirely about where it is going.
 */
const MEGAMOUTH_DURATION = 35;
/** Three times a large great white. Half again on what it was - it should be unmistakable. */
const MEGAMOUTH_SIZE = 3;
/** Twice what it was. At half this it crossed slowly enough to be scenery rather than a hazard. */
const MEGAMOUTH_SPEED = 0.84;
/** Its own reach, in world units - it is enormous, and the hit box has to say so. */
const MEGAMOUTH_HIT_RADIUS = 13;
/** How far past the edge it goes before wrapping round, in world units. */
const MEGAMOUTH_WRAP_MARGIN = 26;
/**
 * What it takes to bring one down: ten dolphins in the water and three boosted rams.
 *
 * Deliberately the Matriarch's own shape - a pod requirement past anything a shark asks for, and
 * three hits rather than one - because by the time it is the last thing alive the level has
 * become a boss fight whether or not it was billed as one. Ten is inside the Mesopelagic's cap of
 * fifteen with room to lose a few on the way, so a pod that has been played well can always
 * finish it.
 */
const MEGAMOUTH_POD_REQUIREMENT = 10;
const MEGAMOUTH_HITS_REQUIRED = 3;
/** What the optional fourth hit pays, over and above the level's own Pearls. */
const MEGAMOUTH_FINISHER_PEARLS = 15;
/** Spacing between rams, so one pass through it cannot land the whole fight. */
const MEGAMOUTH_HIT_COOLDOWN_MS = 900;
/**
 * How long the pod has after the megamouth sweeps one of them, rather than the one second every
 * other hazard allows.
 *
 * It asks for ten dolphins to be hurt and takes them one at a time, so at a second apiece a pod
 * of exactly ten has three seconds of margin before it drops under its own threshold - long
 * enough to be inside it, nowhere near long enough to line a Boost up and land it. Two seconds
 * doubles that window without making the thing safe to swim through.
 */
const MEGAMOUTH_SWEEP_COOLDOWN_MS = 2000;
/**
 * The dolphin spawn interval while the megamouth is the last thing alive.
 *
 * The fight needs ten dolphins and eats them, and by the time it starts every shark is dead - so
 * the ordinary clock is refilling a pod that is being emptied twice as fast, on a level with
 * nothing else left to do. Quicker while the fight is on, and only while it is on.
 */
const MEGAMOUTH_FIGHT_SPAWN_INTERVAL = 7;
/**
 * Its speed once it turns defensive: past the pod's cruise, short of a Boost, so a dash is still
 * what catches it.
 *
 * Down from three. At three it outran an unupgraded pod by a quarter and the fight was a chase
 * the player could not join - every approach had to be a Boost, and a missed Boost meant ten
 * seconds of watching it leave. Just over cruising speed instead, so the pod can shadow it and
 * pick the moment, which is the fight that was wanted rather than a pursuit.
 */
const MEGAMOUTH_DEFENSIVE_SPEED_FACTOR = 2.5;
/**
 * How near the pod has to be before it starts steering at them, in world units, and how hard it
 * turns when they are right under its nose.
 *
 * Well under half the arena, so most of the time it is simply crossing and bouncing and you can
 * see where it will be. Inside the range the correction scales up as the gap closes, which is
 * what makes it read as a thing that has noticed you rather than a thing on rails.
 */
const MEGAMOUTH_HOMING_RANGE = 34;
const MEGAMOUTH_HOMING_STRENGTH = 0.55;
/** How close to the side walls it may get before turning off them, in world units. */
const MEGAMOUTH_WALL_MARGIN = 10;
/**
 * Where a beaten one comes to rest, how fast it goes down, and how often it bleeds.
 *
 * High enough off the floor that the body sits on the bottom rather than half through it - it is
 * drawn three times a large great white, so its middle is a long way from its belly. It sinks at
 * something under its cruising speed: this is a thing giving up, not a thing diving.
 */
const MEGAMOUTH_SETTLE_Y = SIZE_Y - 13;
const MEGAMOUTH_SINK_SPEED = 0.55;
const MEGAMOUTH_TRAIL_MS = 260;
const MEGAMOUTH_BLEED_MS = 500;
/**
 * Lights along its underside, in the strip's own frame coordinates - the same space the sharks'
 * photophores are given in. Spaced unevenly on purpose: an even row reads as something made,
 * and the one thing this has to read as is alive.
 */
const MEGAMOUTH_PHOTOPHORES = [
  { x: -23, y: 13 },
  { x: -13, y: 15 },
  { x: -2, y: 14 },
  { x: 9, y: 15 },
  { x: 18, y: 13 },
  { x: 24, y: 10 },
];
/**
 * The cry from below: one moment on level 5 where something enormous is heard and not seen.
 *
 * The kraken lives six levels further down and will not be met until the Mesopelagic, which is a
 * long way to go on nothing. This is the whole of its foreshadowing - the same recording it
 * arrives to, at a depth where there is no possible explanation for it - and the water's answer
 * is the point of it: every shark in the level stops dead and listens. A player who learns that
 * noise here knows exactly what the five-second warning means when it comes, and knows it before
 * the arms do.
 *
 * Thirty seconds into that level - counted from when the level opens, not from when the run
 * began - so it is properly under way and the sharks are in the middle of hunting rather than
 * still spreading out. Stopping means nothing until there is something to stop. The hold is the
 * length of the recording.
 */
const DEEP_CRY_LEVEL = 5;
const DEEP_CRY_AT = 30;
const DEEP_CRY_MS = 4800;
const JELLYFISH_COUNT = 50;
const STORM_VISIBILITY_RADIUS = 18;
/**
 * How far the pod can see for itself, in world units, in water with no gloom at all and in water
 * at full gloom. Below the sunlit zone this is the whole of the difficulty: a shark outside this
 * ring is not drawn and not hinted at, and the only way to find one is to ping for it.
 */
const GLOOM_SIGHT_LIT = 22;
const GLOOM_SIGHT_DARK = 10;
/** The lit circle sits a little outside the Echolocation ring, so the ring itself stays legible. */
const GLOOM_ECHO_MARGIN = 1.08;
/**
 * The shallowest depth a Level Select dive is lent Echolocation at: the first level of the
 * Mesopelagic, which is where the water starts being dark.
 */
const ECHO_LENT_FROM_LEVEL = 11;
/** The pod a sandbox hands you, enough to ram anything currently benched there. */
const SANDBOX_STARTING_POD = 5;
const MATRIARCH_HITS_REQUIRED = 3;
const MATRIARCH_HIT_COOLDOWN_MS = 900;
const LARGE_SHARK_SIZE_MULTIPLIER = 1.8;
/**
 * The large tiger, which is bigger again than everything else large - it is drawn from a strip
 * that renders at half the others' scale (SHARK_KIND_SCALE), so the number has to be larger to
 * arrive at the same place. Up a fifth from 2.5: it is the shark that vanishes and reappears, and
 * it should be unmistakable in the moment it is visible.
 */
const LARGE_TIGER_SIZE_MULTIPLIER = 3;
// The tiger sprite draws at half the scale of the other two kinds (SHARK_KIND_SCALE), which
// left small tigers looking undersized against them - a third bigger reads much better.
const SMALL_TIGER_SIZE_MULTIPLIER = 1.33;
// Large-tiger cloak: it drops out of sight while still hunting you, holds that for twenty
// seconds, then has to spend twenty visible ones recharging. Only comes out once the small
// sharks are gone, so it is an endgame threat rather than something you meet on level one.
const CLOAK_DURATION_MS = 20000;
const CLOAK_COOLDOWN_MS = 20000;
// Up to and including this level, a large great white needs 10 pod members rather than 12.
// Breathing room at the start of a level, counted from the first tick that actually runs.
const LEVEL_START_INVULNERABILITY_MS = 5000;
// While that safety window runs the sharks fade back, so a swarm arriving on top of the pod
// cannot bury it and the player can see at a glance that nothing can touch them yet. The fade
// eases back to full over the last stretch rather than popping, so the threat returns smoothly.
// Parallax. The backgrounds are single flat stills, so depth cannot come from separate layers
// of artwork - it comes from the camera instead. The background is drawn slightly larger than
// the canvas and leans against the player's movement, while a field of drifting motes sits in
// front of it and leans further, so the two planes separate as you swim.
const BG_OVERSCAN = 1.14;
const BG_PARALLAX_PX = CANVAS_W * 0.045;
/** How much further the near plane travels than the background. This ratio is the parallax. */
const NEAR_PARALLAX_FACTOR = 2.4;
const MOTE_COUNT = 30;
/**
 * Slow push-in: the background creeps toward the camera for the whole level, easing off as it
 * goes, so the scene is never quite still without ever visibly zooming. Eight percent over a
 * couple of minutes is far below the 14% overscan, so it only ever crops tighter and can never
 * drag an edge into view.
 */
const BG_PUSH_IN = 0.08;
/** Seconds to reach ~63% of the push-in. Long, because a push-in you can notice is too fast. */
const BG_PUSH_IN_TAU = 45;
/** Light shafts: their own plane between the background and the motes. */
const SHAFT_COUNT = 5;
const SHAFT_PARALLAX_FACTOR = 1.5;
/** Bubbles sit nearest the camera, so they travel furthest as the view leans. */
const BUBBLE_COUNT = 14;
const BUBBLE_PARALLAX_FACTOR = 3.2;
// Each Magic Shrimp spent adds this much swim speed for the rest of the level, and they
// stack additively - three of them is +150%, not 3.4x, which keeps the maths legible to a
// player deciding whether to spend a second one.
const SHRIMP_SPEED_BONUS = 0.5;
// Ghost Shrimp: half a minute where no shark can find the pod or touch it. Long enough to cross
// the map and rebuild a pod that has just been shredded, which is the moment it exists for.
const GHOST_DURATION_MS = 30000;
const GHOST_POD_ALPHA = 0.45;
// Pistol Shrimp: a real one stuns its prey with a cavitation bubble, so the blast reads as a
// snap rather than an explosion. Radius is a little under half the play area's height.
const PISTOL_BLAST_RADIUS = 20;
const PISTOL_STUN_MS = 4000;
const SHARK_FADE_WHILE_SAFE = 0.55;
const SHARK_FADE_RESTORE_MS = 700;
// Draw order inside the entity container. Sprites were previously stacked in creation order,
// which put the sharks - spawned per level, after the player exists - on top of the pod, and
// left the player dolphin at the very bottom under everything. A swarm arriving at the start of
// a level then physically hid the dolphins you were steering. Your own pod always draws on top.
// How much clear water a shark is given at spawn. Slightly wider than the old 15-per-axis box,
// so the opening of a level is never an ambush you could not have seen coming.
const SHARK_SPAWN_CLEARANCE = 22;
const Z_SHARK = 0;
const Z_DOLPHIN = 10;
const Z_PLAYER = 20;
const SPRINT_DURATION = 300;
const SPRINT_COOLDOWN = 10000;
const SPRINT_SPEED = 2;
// Game-feel: a brief freeze-frame and a light screen shake on large-shark kills.
const HIT_STOP_MS = 70;
const SHAKE_MAGNITUDE = 3.5;
const SHAKE_DURATION_MS = 200;
const COMBO_RESET_SECONDS = 2.5;
const SHARK_BASE_SCALE = 0.6;
// How far outside its bite reach a shark opens its jaws - pure anticipation. This used to be a
// flat 6-unit trigger while the bite itself needed 4 units and only ever tested the dolphin you
// were steering, so the animation regularly played over a follower with no bite behind it.
const SHARK_ATTACK_ANTICIPATION = 1.5;
/**
 * How long after a tap-fired Boost a second tap can still take it back.
 *
 * Has to stay above main.ts's DOUBLE_TAP_MS: that decides how late a second tap still counts as
 * a double tap, and this decides how late the first tap's boost can still be refunded. If the
 * window closed first, a slow double tap would cost a boost and ping anyway.
 */
const BOOST_UNDO_WINDOW_MS = 500;
/** Radii of the two ability arcs drawn around the player, just outside the body. */
const BOOST_METER_RADIUS = 17;
const ECHO_METER_RADIUS = 21;
const SHARK_KIND_SCALE: Record<SharkKind, number> = {
  greatWhite: 2,
  hammerhead: 2,
  tiger: 1,
  // Both deep-water species are drawn from the tiger strip, so they share its base scale and
  // are sized against each other by SHARK_KIND_LOOK below.
  frilled: 1,
  cookiecutter: 1,
};
/**
 * Large cookiecutter: it picks one dolphin out of the pod and runs at it.
 *
 * The real animal takes a single bite out of something far bigger than itself and leaves, which
 * is the behaviour this is after: not a chase, but one committed run at one dolphin. The warning
 * is the whole of the counterplay - the run is aimed once, when the warning ends, and never
 * corrected, so moving the pod off that line is a dodge rather than a postponement.
 *
 * Forty-five seconds between runs, not the thirty it started at. One arriving every half minute
 * meant the warning was always either on screen or about to be, and something that constant is
 * read as the weather rather than as a threat - the gap is what makes the banner mean anything.
 */
const LOCK_INTERVAL_MS = 45000;
/**
 * How long a level gets before the first one. Without it the cooldown starts at zero and the
 * strike lands on the opening tick, so a level could open with a dolphin already being run down
 * before the player had taken a stroke.
 */
const LOCK_FIRST_DELAY_MS = 8000;
/** How long the player has between the banner and the run being aimed. */
const LOCK_WARNING_MS = 1500;
const LOCK_ZOOM_MS = 900;
/** Against the shark's own speed. A cookiecutter is quick; locked on it is the quickest thing down there. */
const LOCK_ZOOM_SPEED = 4.5;
/** It has to be able to see the pod to single one out of it. */
const LOCK_RANGE = 45;

/**
 * Large frilled: the head is thrown forward up to the animal's own length, snake-fashion.
 *
 * The extension is what makes a slow shark dangerous - you can outswim the body and still be
 * inside the strike. It ramps rather than snapping out, and that ramp is the tell: at this size
 * the reach is most of the arena's width, so arriving instantly would be unreadable.
 */
/**
 * How much of its own length the head is thrown, at full extension.
 *
 * Half, not all of it. A full body length is most of the arena's width on an animal this size,
 * which made the strike less a reach than a second shark appearing in front of the first. Half
 * still beats anything that has outswum the body, and is short enough to read as the same
 * creature stretching.
 *
 * The trigger range, the bite point and the drawn stretch all take their distance from here, so
 * what is drawn and what bites cannot come apart.
 */
/**
 * How close the pod has to be for an eye to catch the light, in world units, and how far outside
 * that it begins to show.
 *
 * Deliberately shorter than the reach that follows it, so the eye is not a warning you can act on
 * from a distance - it is confirmation of what you have already swum into.
 */
/**
 * What one level of Responsiveness does to the pod, and the three numbers it moves.
 *
 * The formation is a disk of slots around the player (see moveFollowers), so drawing the radius
 * in shrinks what the pod can brush against - the area falls with the square, which is why four
 * percent a level reaches nearly half the footprint at six. The other two are handling: how fast
 * the whole formation swings round as the player turns, and how hard a follower pulls toward the
 * slot it has been given. Both were fixed at values tuned for a pod that never turned sharply.
 */
const POD_TIGHTEN_PER_LEVEL = 0.04;
const POD_BASE_TURN_RATE = 0.15;
const POD_TURN_PER_LEVEL = 0.02;
const POD_BASE_SMOOTH = 0.22;
const POD_SMOOTH_PER_LEVEL = 0.015;

/**
 * How the deep-water species are told apart at a glance, which is most of what the Mesopelagic
 * asks of a player.
 *
 * The lights carry two facts. How many there are says which species it is - one for a
 * cookiecutter, two for a frilled shark - and whether they blink says how big it is. Both had to
 * be built, because until now every one of them drew at exactly the same dot size: the clamp that
 * sized them spanned 1.1 to 1.5 and every deep shark in the game landed on 1.1, adult and
 * juvenile alike.
 */
const PHOTOPHORE_DOT_JUVENILE = 1.05;
const PHOTOPHORE_DOT_ADULT = 2;

const SHARK_EYE_RANGE = 14;
const SHARK_EYE_FADE = 6;

const FRILLED_REACH_FRACTION = 0.5;
const REACH_EXTEND_MS = 450;
const REACH_HOLD_MS = 250;
const REACH_RETRACT_MS = 350;
/**
 * How long the head takes to recharge between strikes.
 *
 * Long, at 20 seconds. On a three-second recharge the strike came round roughly every four, which
 * turned the reach into the shark's ordinary way of moving rather than a thing it did - and left
 * no window in which a dolphin could safely be inside the range the body cannot reach. A spent
 * strike now buys real time on the wrong side of it, which is what makes getting close to a
 * frilled shark a decision rather than a mistake.
 */
const REACH_COOLDOWN_MS = 20000;

const HAMMERHEAD_SPEED_BONUS = 1.15;
const GREAT_WHITE_LARGE_SPEED_BONUS = 1.25;
/** What a large great white or hammerhead keeps of its speed in the dark - see mesopelagicLargeSpeedFactor. */
const MESO_LARGE_SPEED_FACTOR = 0.84;

/** Which loaded strip a kind is animated from. Three sheets, five species. */
export type SharkStrip = 'greatWhite' | 'hammerhead' | 'tiger';

/**
 * Everything the Sharkopedia needs to draw a shark the way the water draws it.
 *
 * Exported from here rather than restated in the view, because the look tables live here and a
 * second copy of them would be wrong the first time a tint is tuned. The view has no Pixi of its
 * own - it paints frame zero of the same strip onto a canvas - so it needs the numbers rather
 * than the sprite.
 */
export interface SharkArt {
  strip: SharkStrip;
  /** Multiply tint, as the sprite uses it. */
  tint: number;
  /** Width and height against the strip's own frame, before scale. */
  stretchX: number;
  stretchY: number;
  /** How big this one is drawn against a small tiger, which is the roster's smallest. */
  scale: number;
  /**
   * Lights along the belly, in the strip's own frame coordinates - the same space the sprite
   * places them in, so they land on the animal at whatever size it is drawn.
   *
   * Only the three deep-water species carry any. They are most of how those three are recognised
   * in the water, where the body itself is often not visible at all, so a picture of one without
   * its lights is a picture of the wrong animal.
   */
  photophores?: { x: number; y: number }[];
  photophoreColor?: number;
  /**
   * Eyes, which the book draws flat rather than lit - they are not lights the animal is making.
   * A species can carry these as well as photophores; the frilled shark carries both.
   */
  eyes?: { x: number; y: number }[];
  eyeColor?: number;
}

/**
 * The art for the two that are not simply a species at a size.
 *
 * Both are built from the great white's strip in the water and both are built from it here, with
 * the same numbers: the Matriarch at twice a large one, the megamouth at three times and blacked
 * out to the near-black it swims as. Neither is pure black - a flat 0x000000 kills the strip's
 * shading and leaves a hole rather than an animal.
 */
export function specialSharkArt(special: 'matriarch' | 'megamouth'): SharkArt {
  const base = sharkArt('greatWhite', true);
  if (special === 'matriarch') {
    return { ...base, scale: SHARK_KIND_SCALE.greatWhite * LARGE_SHARK_SIZE_MULTIPLIER * 2 };
  }
  return {
    ...base,
    tint: 0x14161f,
    scale: SHARK_KIND_SCALE.greatWhite * MEGAMOUTH_SIZE,
    photophores: MEGAMOUTH_PHOTOPHORES,
    photophoreColor: 0x93c5fd,
  };
}

/** The art for one entry in the book: a species at a size. */
export function sharkArt(kind: SharkKind, large: boolean): SharkArt {
  const look = SHARK_KIND_LOOK[kind];
  const size = large ? (kind === 'tiger' ? LARGE_TIGER_SIZE_MULTIPLIER : LARGE_SHARK_SIZE_MULTIPLIER) : look.smallSize;
  return {
    strip: SHARK_SPRITE_SOURCE[kind],
    tint: look.tint,
    stretchX: look.stretchX,
    stretchY: look.stretchY,
    scale: SHARK_KIND_SCALE[kind] * size,
    photophores: look.photophores,
    photophoreColor: look.photophoreColor,
    eyes: look.eyes,
    eyeColor: look.eyeColor,
  };
}

const SHARK_SPRITE_SOURCE: Record<SharkKind, SharkStrip> = {
  greatWhite: 'greatWhite',
  hammerhead: 'hammerhead',
  tiger: 'tiger',
  frilled: 'tiger',
  cookiecutter: 'tiger',
};

/**
 * Everything that makes one kind of shark look and move like itself rather than like the strip it
 * borrows. Four cheap levers - colour, proportion, frame rate and size - are enough to get a new
 * species out of an existing sheet, which is the only way the roster grows without new artwork.
 */
interface SharkLook {
  /**
   * Eyes that catch the light once the pod is inside SHARK_EYE_RANGE, in the strip's own frame
   * coordinates. Carried alongside photophores rather than instead of them, and drawn plainly -
   * see createEyes. An eye is not a light the animal is making.
   */
  eyes?: { x: number; y: number }[];
  eyeColor?: number;
  /** Multiplied into the artwork's colour; 0xffffff leaves it as drawn. */
  tint: number;
  /** Non-uniform scale on top of the shark's size, for reshaping a borrowed silhouette. */
  stretchX: number;
  stretchY: number;
  /** Frame rate against the stock swim cycle: below 1 undulates, above 1 flicks. */
  animationSpeed: number;
  /** The threat glow under the sprite. */
  glow: string;
  /** How big a small one of these is drawn. */
  smallSize: number;
  /** Speed against the level's own multiplier. */
  speed: number;
  /**
   * Lights along the underside, in the strip's own frame coordinates. A deep-water species has
   * them for the same reason the real ones do, and for one of ours: in black water they are the
   * only thing that gives a shark's position away, so a player can follow a pair of lights
   * drifting in the dark without being able to see what is carrying them.
   */
  photophores?: Photophore[];
  photophoreColor?: number;
}

const THREAT_GLOW = 'rgba(248, 113, 113, 0.5)';

const SHARK_KIND_LOOK: Record<SharkKind, SharkLook> = {
  greatWhite: { tint: 0xffffff, stretchX: 1, stretchY: 1, animationSpeed: 1, glow: THREAT_GLOW, smallSize: 1, speed: 1 },
  hammerhead: { tint: 0xffffff, stretchX: 1, stretchY: 1, animationSpeed: 1, glow: THREAT_GLOW, smallSize: 1, speed: HAMMERHEAD_SPEED_BONUS },
  tiger: { tint: 0xffffff, stretchX: 1, stretchY: 1, animationSpeed: 1, glow: THREAT_GLOW, smallSize: SMALL_TIGER_SIZE_MULTIPLIER, speed: 1 },
  /**
   * Frilled shark: the tiger pulled long and flattened until it reads as an eel, drained to the
   * pale grey-brown of something that has never seen daylight, and worked through its frames at
   * half speed so the whole body appears to ripple rather than beat. Slower than a tiger in the
   * water to match - it is meant to be outswum, not outfought.
   */
  frilled: {
    // As dark as the cookiecutter. It used to be a pale grey-brown, which made the one deep-water
    // shark you could see coming; black, it has to be found the way the cookiecutter is found.
    tint: 0x3d4352,
    stretchX: 2.05,
    stretchY: 0.56,
    animationSpeed: 0.5,
    glow: THREAT_GLOW,
    smallSize: 1.55,
    speed: 0.85,
    // Two, well apart, so the pair reads as something long even when the body itself cannot be
    // seen - the gap between the lights is the only measure of its size in the dark.
    photophores: [
      { x: -14, y: 5 },
      { x: 10, y: 5 },
    ],
    // Green, like the cookiecutter's. What tells the two apart is how many there are, not what
    // colour they are: a player in dark water counts lights long before they can judge a hue.
    photophoreColor: 0x4ade80,
    /**
     * And an eye on top of them, which is a different thing entirely: not an organ it lights the
     * water with but an eye catching what little light there is, only once you are close enough
     * to be looking at it. The lights say something long is out there; the eye says it has seen
     * you.
     */
    eyes: [{ x: 15, y: -4 }],
    eyeColor: 0x4ade80,
  },
  /**
   * Cookiecutter: a tiger shrunk to a third, blacked out, and animated fast so it flicks about.
   * Its glow is the green of the real animal's underside rather than the usual red, which is also
   * the only way to spot one in dark water before it reaches you.
   */
  cookiecutter: {
    tint: 0x3d4352,
    stretchX: 1.12,
    stretchY: 0.82,
    animationSpeed: 1.7,
    glow: 'rgba(74, 222, 128, 0.55)',
    smallSize: 0.62,
    /**
     * Quick, but no longer the quickest thing in the water by a clear margin.
     *
     * At 1.3 it outran every other species - a hammerhead is 1.15 and everything else 1.0 - and
     * being both the hardest to see and the fastest to arrive left very little to do about one.
     * Down again from 1.15, which had it level with the hammerhead: on a level fielding several
     * at once they arrived together and there was no gap in which to deal with any one of them.
     * Barely above the field now, and still the quickest thing there, which is the whole of its
     * character - it simply no longer beats you to every piece of water. The lock-on run scales
     * off this too, so the strike comes down with it.
     */
    speed: 1.02,
    // One, and green, like the real animal's. A single point moving fast is all the warning a
    // player gets of one of these.
    photophores: [{ x: 1, y: 5 }],
    photophoreColor: 0x4ade80,
  },
};

const SHARK_INTRO_INFO: Partial<Record<SharkKind, { name: string; description: string }>> = {
  tiger: {
    name: 'Tiger Shark',
    description: 'Smaller tigers stay close, but larger ones can freeze and lunge at you.',
  },
  hammerhead: {
    name: 'Hammerhead',
    description: 'These sharks will pursue you more relentlessly and can follow you off screen.',
  },
  greatWhite: {
    name: 'Great White Shark',
    description: 'Older Great Whites grow far larger - it takes a big pod and a Boost dash to bring one down.',
  },
  frilled: {
    name: 'Frilled Shark',
    description:
      'A long eel of a shark from the twilight water. It is slower than anything else down here, it comes round at you from the side rather than straight on, and it never stops. Seven dolphins would see one off; you are meant to outswim it, not outfight it.',
  },
  cookiecutter: {
    name: 'Cookiecutter Shark',
    description:
      'Small, black and quick, lit only by the green glow of its own belly. One is barely a threat, but it takes five dolphins to see off, and they do not travel alone.',
  },
};

const LARGE_SHARK_INTRO_INFO: Partial<Record<SharkKind, { name: string; description: string }>> = {
  tiger: {
    name: 'Large Tiger Shark',
    description:
      'Large tigers can freeze and lunge straight at you. With the small sharks gone they also vanish from sight while still hunting - they only surface once they have fed. Keep moving.',
  },
  hammerhead: {
    name: 'Large Hammerhead Shark',
    description: 'Large hammerheads are faster and can pursue you relentlessly.',
  },
  greatWhite: {
    name: 'Large Great White Shark',
    description: 'A huge great white that can charge at high speed. It takes a full pod to bring down.',
  },
};

type GameEventType = 'storm' | 'jellyfish' | 'kraken' | 'megamouth';

export class Game {
  private canvas: HTMLCanvasElement;
  private app!: Application;

  private keys: Record<string, boolean> = {};
  private environment: number[][] = [];
  private dolphins: Dolphin[] = [];
  private sharks: Shark[] = [];
  private player: Dolphin | null = null;
  /** Orientation of the pod formation, in radians - eased toward the player's heading. */
  private podHeading = 0;
  private dolphinSpawnInterval = DOLPHIN_SPAWN_INTERVAL;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Seconds of actual play in the current level attempt (resets on retry). Drives spawn /
   * event timers and the on-screen clock. Advances only while step() runs, so time spent on
   * a pause / overlay does not count. */
  private gameTime = 0;
  /** Seconds of actual play across the whole run - survives retries and level transitions,
   * resets only on a fresh start. This is the leaderboard time. */
  private runElapsed = 0;
  private nextDolphinSpawnTime = 60;
  private lastFrameTime = 0;
  private playerHitCooldownUntil = 0;
  private huntingMode = false;
  private readyToSchool = false;
  private maxDolphins = 8;
  private bubbleTimer = 0;
  private activeEvent: { type: GameEventType; endsAt: number } | null = null;
  private nextEventCheckTime = EVENT_CHECK_INTERVAL;
  private pendingEvent: GameEventType | null = null;
  /** When the run-up warning for the next event is due, and whether it has been given. */
  private nextEventWarningTime = -5;
  private eventWarningShown = false;
  private jellyfish: Jellyfish[] = [];
  private jellyfishContainer!: Container;
  /**
   * The kraken's arms: the bodies under the gloom, their lights above it.
   *
   * Two layers rather than one. Drawing the whole arm above the overlay lit the arena up and threw
   * away the darkness the zone is built on; drawing it all underneath left a hazard the player is
   * asked to dodge and cannot see. Split, the arm is a shape half-glimpsed in the dark and a row
   * of lights that carries - which is the same bargain every deep-water shark down here strikes.
   */
  /** The level this run's one megamouth is rolled onto, or null outside a run. */
  private megamouthRunLevel: number | null = null;
  /** Set once the run's encounter has been fought and won, so it is never dealt again. */
  private megamouthDone = false;
  /** Whether this level is the one carrying the encounter, and whether it has arrived yet. */
  private megamouthEncounterScheduled = false;
  private megamouthAppearedThisLevel = false;
  private krakenContainer!: Container;
  private tentacles: Tentacle[] = [];
  private tentacleGfx = new Map<Tentacle, Graphics>();
  private tentacleLightGfx = new Map<Tentacle, Graphics>();
  /** The megamouth, if one is crossing. Never in `sharks` - see startMegamouth. */
  private megamouth: Megamouth | null = null;
  private megamouthSprite: Container | null = null;
  private megamouthLights: Container | null = null;
  /** Rate limit on rams landing on the megamouth - see MEGAMOUTH_HIT_COOLDOWN_MS. */
  private megamouthHitCooldownUntil = 0;
  /** Set once, when it turns on the pod, so the moment is announced a single time. */
  private megamouthTurnedAnnounced = false;
  private jellyfishSprites = new Map<Jellyfish, Container>();
  private matriarch: Shark | null = null;
  private matriarchWarningTime = 0;
  private matriarchSpawnTime = 0;
  private matriarchWarningShown = false;
  private matriarchSpawnerTimer = 0;
  private matriarchSmallCleared = false;
  private matriarchEnraged = false;
  private levelCompleted = false;
  private levelCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingNewWaters = false;
  private awaitingLevelUpChoice = false;
  private awaitingSharkWarning = false;
  private awaitingRunSummary = false;
  private awaitingTutorialHint = false;
  /** The Endless "Level 50!" share overlay is open (gates the loop like the other awaiting* flags). */
  private awaitingMilestone = false;
  /** Set when level 50 is cleared in Endless, so the levelComplete timer shows the milestone overlay. */
  private pendingMilestone = false;
  /** The Android "Continue your run?" offer is open (gates the loop). */
  private awaitingContinue = false;
  /** One paid/ad Continue per Endless run. */
  private continueUsedThisRun = false;
  /** Endless deaths this session, for the every-3rd interstitial (Android). */
  private endlessDeaths = 0;
  /** Achievement ids unlocked during the current run, for the run-summary card. */
  private achievementsThisRun: string[] = [];
  private hintQueue: { heading: string; text: string }[] = [];
  private seenSharkKinds = new Set<SharkKind>();
  /**
   * Species the run has actually put in the water as small sharks, level by level.
   *
   * Distinct from seenSharkKinds, which is the level's *pool* and drives the intro cards: a pool
   * can name a species that its random draw then never spawns. This is what was really there, and
   * it is what decides whether a species is allowed to turn up large - see largeKindPool.
   */
  private seenSmallSharkKinds = new Set<SharkKind>();
  private seenLargeSharkKinds = new Set<SharkKind>();
  private seenLargeSharkVariety = false;
  private autoFormedForThisPod = false;
  /** Set when a level is set up; consumed by the first tick of the loop that actually runs. */
  private pendingLevelInvulnerability = false;
  /** Speed added by Magic Shrimp spent this level, as a fraction. Cleared on level entry. */
  private shrimpSpeedBonus = 0;
  /** While Date.now() is under this, a Ghost Shrimp is hiding the pod from every shark. */
  private ghostUntil = 0;
  // Echolocation (Endless only, bought in the Store once the campaign is cleared). While it is
  // running, sharks inside echoRadius are drawn even if a storm or a tiger's cloak is hiding
  // them - see the draw loop and sharkRevealedByEcho.
  private echoAvailable = false;
  private echoEndTime = 0;
  private echoCooldownEnd = 0;
  private echoDurationMs = 0;
  private echoCooldownMs = 0;
  private echoRadius = 0;
  /** When the current ping started, so the expanding ring can be drawn from it. */
  private echoStartedAt = 0;
  /**
   * Deadline for the level-opening safety window, kept separate from the player's own
   * invulnerableUntil: that is also set by a revive and after a bite, and fading every shark on
   * screen mid-fight would read as a glitch rather than as a moment of safety.
   */
  private levelStartSafeUntil = 0;
  private currentLevel = 1;
  /**
   * The level a Depthless run began at. 1 for an ordinary dive; deeper when the player bought
   * their way down, which is what keeps that run off the leaderboard - see startLevelIsRanked.
   */
  private depthlessStartLevel = 1;
  private retries = 0;
  private totalRecruited = 0;
  private totalLost = 0;
  private sharksKilled = 0;
  private lostThisLevel = 0;
  private sessionStartTime = 0;
  // Lifetime-achievement bookkeeping (see flushLifetimeStats / src/lifetimeStats.ts).
  private syncedSharkKills = 0;
  private lastBoostNudgeTime = 0;
  private unsyncedPlaySeconds = 0;
  private lifetimeFlushAt = 0;
  private playDayRecorded = false;
  private wasOnLastLifeThisLevel = false;
  private lostAtSwarmStart = 0;
  private achievementQueue: { icon: string; name: string }[] = [];
  private sprinting = false;
  private sprintEndTime = 0;
  private sprintCooldownEnd = 0;
  /** When the last Boost began, and what the cooldown was before it, so it can be given back. */
  private sprintStartedAt = 0;
  private sprintPrevCooldownEnd = 0;
  private sprintCooldownReduction = 0;
  /** Extra sprint duration in ms from the Store's Boost Duration upgrade (Endless only). */
  private sprintDurationBonus = 0;
  /** Levels of the Store's Responsiveness upgrade. Endless only, like every other Store line. */
  private podResponsiveness = 0;
  /**
   * Whether Iron Skin is being carried this run.
   *
   * It does nothing in the water. It is read once, at the moment a descent would go past
   * IRON_SKIN_UNLOCK_LEVEL, and a run without it turns back there - see turnBackAtTheCrush.
   */
  private ironSkin = false;
  // Game feel: hit-stop freezes the sim until this time; the shake jitters the Pixi stage.
  private hitStopUntil = 0;
  private shakeTime = 0;
  private shakeMagnitude = 0;
  /** Consecutive shark kills; drives the rising combo pitch. Resets after a gap / dolphin loss / level. */
  private killCombo = 0;
  private lastKillTime = 0;
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private vitalityLives = 0;
  private speedBonusPct = 0;
  private charismaBonusDolphins = 0;
  private totalDolphinsSaved = 0;
  private megaPodAvailable = false;
  private megaPodActive = false;
  private matriarchHitsTaken = 0;
  private matriarchHitCooldownUntil = 0;
  private mode: GameMode = 'campaign';
  private currentLeaderboardBoard: LeaderboardBoard = 'campaign';
  private pendingScore:
    | { board: 'campaign'; score: Omit<NewCampaignScore, 'name'> }
    | { board: 'endless'; score: Omit<NewEndlessScore, 'name'> }
    | null = null;

  private pointerActive = false;
  private pointerDirX = 0;
  private pointerDirY = 0;

  private sharkSpeedInput: HTMLInputElement;
  private speedInput: HTMLInputElement;
  private startBtn: HTMLButtonElement;
  private statTime: HTMLElement;
  private statSpawn: HTMLElement;
  private statDolphins: HTMLElement;
  private statSharks: HTMLElement;
  private statStatus: HTMLElement;
  private sharkGuideList: HTMLElement;
  private lastLifeHeart: HTMLElement | null = null;
  private levelBadgeNumberEl: HTMLElement | null = null;
  private dolphinsSavedBadgeEl: HTMLElement | null = null;
  private dolphinsSavedNumberEl: HTMLElement | null = null;
  private pearlsNumberEl: HTMLElement | null = null;
  /** Pearls earned in the current run, shown on the run-summary card. */
  private pearlsThisRun = 0;
  private bannerEl: HTMLDivElement;
  private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private newWatersPromptEl: HTMLDivElement;
  private pauseOverlayEl: HTMLDivElement;
  private schoolBtnWrap: HTMLDivElement;
  private megaPodBtnWrap: HTMLDivElement | null = null;
  private leaderboardOverlayEl: HTMLDivElement | null = null;
  private leaderboardListEl: HTMLElement | null = null;
  private leaderboardHeadEl: HTMLElement | null = null;
  private leaderboardHeadingEl: HTMLElement | null = null;
  private leaderboardTabCampaignBtn: HTMLButtonElement | null = null;
  private leaderboardTabEndlessBtn: HTMLButtonElement | null = null;
  private leaderboardGlobalEl: HTMLElement | null = null;
  private leaderboardGlobalRankEl: HTMLElement | null = null;
  private leaderboardGlobalBtn: HTMLButtonElement | null = null;
  private leaderboardSignInBtn: HTMLButtonElement | null = null;
  private runSummaryOverlayEl: HTMLDivElement | null = null;
  private runSummaryTitleEl: HTMLElement | null = null;
  private runSummaryNameEl: HTMLElement | null = null;
  private runSummaryStatsEl: HTMLElement | null = null;
  private runSummaryAchievementsEl: HTMLElement | null = null;
  private runSummaryShareBtnEl: HTMLButtonElement | null = null;
  private runSummaryDoubleBtnEl: HTMLButtonElement | null = null;
  private runSummarySaveBtnEl: HTMLButtonElement | null = null;
  private runSummaryUnrankedEl: HTMLElement | null = null;
  /** One rewarded double per run, whether or not the player took it. */
  private pearlsDoubledThisRun = false;
  /** Bumped on every render of the offer, so a slow preload from an earlier one cannot
   *  re-disable a button a later render has already enabled. */
  private doubleOfferToken = 0;
  private runSummaryHomeBtnEl: HTMLButtonElement | null = null;
  private milestoneOverlayEl: HTMLDivElement | null = null;
  private milestoneTextEl: HTMLElement | null = null;
  private milestoneRewardEl: HTMLElement | null = null;
  private continueOverlayEl: HTMLDivElement | null = null;
  private continueDepthEl: HTMLElement | null = null;
  private continueAdBtnEl: HTMLButtonElement | null = null;
  private continuePayBtnEl: HTMLButtonElement | null = null;
  private gameOverOverlayEl: HTMLDivElement | null = null;
  private tutorialHintOverlayEl: HTMLDivElement | null = null;
  private tutorialHintHeadingEl: HTMLElement | null = null;
  private tutorialHintTextEl: HTMLElement | null = null;
  private megaShrimpHintEl: HTMLElement | null = null;
  private achievementToastEl: HTMLElement | null = null;
  private achievementToastIconEl: HTMLElement | null = null;
  private achievementToastNameEl: HTMLElement | null = null;
  private achievementToastTimeout: ReturnType<typeof setTimeout> | null = null;
  private achievementsOverlayEl: HTMLDivElement | null = null;
  private achievementsListEl: HTMLElement | null = null;
  private levelUpOverlayEl: HTMLDivElement;
  private sharkWarningOverlayEl: HTMLDivElement;
  private sharkWarningListEl: HTMLDivElement;
  private onSchoolingChange?: (active: boolean) => void;
  private onMusicTrackChange?: (url: string) => void;
  private onMusicDuck?: (durationMs: number) => void;
  /** Stops the level music outright, for the game over. Paired with onMusicResume. */
  private onMusicStop?: () => void;
  /** Starts the music again when a run begins - the counterpart to onMusicStop. */
  private onMusicResume?: () => void;
  private onEchoAvailabilityChange?: (available: boolean) => void;
  private onConsumableChange?: (counts: Inventory) => void;
  private lastMusicLevel = 0;
  private paused = false;

  private stage!: Container;
  private bgContainer!: Container;
  private fxContainer!: Container;
  private echoRing!: Graphics;
  private shaftContainer!: Container;
  private bubbleContainer!: Container;
  /** The level's background sprite and the scale it was laid out at, for the push-in. */
  private bgSprite: Sprite | null = null;
  private bgBaseScale = 1;
  /** performance.now() when the current background was placed - the push-in runs from here. */
  private bgPlacedAt = 0;
  private shafts: { gfx: Graphics; sway: number; phase: number; baseX: number; alpha: number }[] = [];
  private bubbles: { gfx: Graphics; speed: number; sway: number; phase: number; radius: number }[] = [];
  /** Near parallax plane: slow motes of drifting matter in front of the background. */
  private driftContainer!: Container;
  private motes: { gfx: Graphics; speed: number; sway: number; phase: number }[] = [];
  // The camera's lean, driven by how the player is moving and decaying back to centre.
  private parallaxLeanX = 0;
  private parallaxLeanY = 0;
  private parallaxX = 0;
  private parallaxY = 0;
  private entityContainer!: Container;
  private stormOverlay!: Graphics;
  /** The darkness at depth, parked on the pod. Hidden entirely in water with no gloom. */
  private gloomOverlay!: Sprite;
  /** Photophores, drawn above the gloom so distance never dims them. See init(). */
  private lightsContainer!: Container;
  /** Each shark sprite's photophore group, which lives in lightsContainer rather than on it. */
  private sharkLights = new Map<Container, Container>();
  /** Eyes, kept apart from the lights above: a different look, and a different reason to be lit. */
  private sharkEyes = new Map<Container, Container>();
  /** This level's darkness, 0 to 1, from its config. */
  private levelGloom = 0;
  private particles!: ParticleSystem;
  private dolphinSprites = new Map<Dolphin, Container>();
  private sharkSprites = new Map<Shark, Container>();

  private glowTexture: Texture;
  private sharkTextureSets: Partial<Record<SharkKind, SharkTextureSet>> = {};

  constructor(
    canvas: HTMLCanvasElement,
    inputs: {
      sharkSpeed: HTMLInputElement;
      speed: HTMLInputElement;
      startBtn: HTMLButtonElement;
      statTime: HTMLElement;
      statSpawn: HTMLElement;
      statDolphins: HTMLElement;
      statSharks: HTMLElement;
      statStatus: HTMLElement;
      sharkGuideList: HTMLElement;
      banner: HTMLDivElement;
      newWatersPrompt: HTMLDivElement;
      pauseOverlay: HTMLDivElement;
      schoolBtnWrap: HTMLDivElement;
      levelUpOverlay: HTMLDivElement;
      sharkWarningOverlay: HTMLDivElement;
      sharkWarningList: HTMLDivElement;
      onSchoolingChange?: (active: boolean) => void;
      onMusicTrackChange?: (url: string) => void;
      onMusicDuck?: (durationMs: number) => void;
      onMusicStop?: () => void;
      onMusicResume?: () => void;
      onEchoAvailabilityChange?: (available: boolean) => void;
      onConsumableChange?: (counts: Inventory) => void;
    }
  ) {
    this.canvas = canvas;

    this.sharkSpeedInput = inputs.sharkSpeed;
    this.speedInput = inputs.speed;
    this.startBtn = inputs.startBtn;
    this.statTime = inputs.statTime;
    this.statSpawn = inputs.statSpawn;
    this.statDolphins = inputs.statDolphins;
    this.statSharks = inputs.statSharks;
    this.statStatus = inputs.statStatus;
    this.sharkGuideList = inputs.sharkGuideList;
    this.bannerEl = inputs.banner;
    this.newWatersPromptEl = inputs.newWatersPrompt;
    this.pauseOverlayEl = inputs.pauseOverlay;
    this.schoolBtnWrap = inputs.schoolBtnWrap;
    this.megaPodBtnWrap = document.getElementById('megaPodBtnWrap') as HTMLDivElement | null;
    this.leaderboardOverlayEl = document.getElementById('leaderboardOverlay') as HTMLDivElement | null;
    this.leaderboardListEl = document.getElementById('leaderboardList') as HTMLElement | null;
    this.leaderboardHeadEl = document.getElementById('leaderboardHead') as HTMLElement | null;
    this.leaderboardHeadingEl = document.getElementById('leaderboardHeading') as HTMLElement | null;
    this.leaderboardTabCampaignBtn = document.getElementById('leaderboardTabCampaign') as HTMLButtonElement | null;
    this.leaderboardTabEndlessBtn = document.getElementById('leaderboardTabEndless') as HTMLButtonElement | null;
    this.leaderboardTabCampaignBtn?.addEventListener('click', () => this.showLeaderboard('campaign'));
    this.leaderboardTabEndlessBtn?.addEventListener('click', () => this.showLeaderboard('endless'));
    this.leaderboardGlobalEl = document.getElementById('leaderboardGlobal');
    this.leaderboardGlobalRankEl = document.getElementById('leaderboardGlobalRank');
    this.leaderboardGlobalBtn = document.getElementById('leaderboardGlobalBtn') as HTMLButtonElement | null;
    this.leaderboardSignInBtn = document.getElementById('leaderboardSignInBtn') as HTMLButtonElement | null;
    this.leaderboardGlobalBtn?.addEventListener('click', () => void playGames.open(this.currentLeaderboardBoard));
    this.leaderboardSignInBtn?.addEventListener('click', async () => {
      await playGames.signIn();
      this.showLeaderboard(this.currentLeaderboardBoard);
    });
    this.runSummaryOverlayEl = document.getElementById('runSummaryOverlay') as HTMLDivElement | null;
    this.runSummaryTitleEl = document.getElementById('runSummaryTitle');
    this.runSummaryNameEl = document.getElementById('runSummaryName');
    this.runSummaryStatsEl = document.getElementById('runSummaryStats');
    this.runSummaryAchievementsEl = document.getElementById('runSummaryAchievements');
    this.runSummaryShareBtnEl = document.getElementById('runSummaryShareBtn') as HTMLButtonElement | null;
    this.runSummaryDoubleBtnEl = document.getElementById('runSummaryDoubleBtn') as HTMLButtonElement | null;
    this.runSummarySaveBtnEl = document.getElementById('runSummarySaveBtn') as HTMLButtonElement | null;
    this.runSummaryUnrankedEl = document.getElementById('runSummaryUnranked');
    this.runSummaryHomeBtnEl = document.getElementById('runSummaryHomeBtn') as HTMLButtonElement | null;
    this.milestoneOverlayEl = document.getElementById('milestoneOverlay') as HTMLDivElement | null;
    this.milestoneTextEl = document.getElementById('milestoneText');
    this.milestoneRewardEl = document.getElementById('milestoneReward');
    this.continueOverlayEl = document.getElementById('continueOverlay') as HTMLDivElement | null;
    this.continueDepthEl = document.getElementById('continueDepth');
    this.continueAdBtnEl = document.getElementById('continueAdBtn') as HTMLButtonElement | null;
    this.continuePayBtnEl = document.getElementById('continuePayBtn') as HTMLButtonElement | null;
    this.gameOverOverlayEl = document.getElementById('gameOverOverlay') as HTMLDivElement | null;
    this.tutorialHintOverlayEl = document.getElementById('tutorialHintOverlay') as HTMLDivElement | null;
    this.tutorialHintHeadingEl = document.getElementById('tutorialHintHeading') as HTMLElement | null;
    this.tutorialHintTextEl = document.getElementById('tutorialHintText') as HTMLElement | null;
    this.megaShrimpHintEl = document.getElementById('megaShrimpHint') as HTMLElement | null;
    this.achievementToastEl = document.getElementById('achievementToast') as HTMLElement | null;
    this.achievementToastIconEl = document.getElementById('achievementToastIcon') as HTMLElement | null;
    this.achievementToastNameEl = document.getElementById('achievementToastName') as HTMLElement | null;
    this.achievementsOverlayEl = document.getElementById('achievementsOverlay') as HTMLDivElement | null;
    this.achievementsListEl = document.getElementById('achievementsList') as HTMLElement | null;
    this.levelUpOverlayEl = inputs.levelUpOverlay;
    this.sharkWarningOverlayEl = inputs.sharkWarningOverlay;
    this.sharkWarningListEl = inputs.sharkWarningList;
    this.onSchoolingChange = inputs.onSchoolingChange;
    this.onMusicTrackChange = inputs.onMusicTrackChange;
    this.onMusicDuck = inputs.onMusicDuck;
    this.onMusicStop = inputs.onMusicStop;
    this.onMusicResume = inputs.onMusicResume;
    this.onEchoAvailabilityChange = inputs.onEchoAvailabilityChange;
    this.onConsumableChange = inputs.onConsumableChange;
    this.lastLifeHeart = document.getElementById('lastLifeHeart');
    this.levelBadgeNumberEl = document.getElementById('levelBadgeNumber');
    this.dolphinsSavedBadgeEl = document.getElementById('dolphinsSavedBadge');
    this.dolphinsSavedNumberEl = document.getElementById('dolphinsSavedNumber');
    this.pearlsNumberEl = document.getElementById('pearlsNumber');

    this.glowTexture = makeRadialGradientTexture(64, 'rgba(34, 211, 238, 0.45)');
  }

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: CANVAS_W,
      height: CANVAS_H,
      background: '#020617',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app.canvas.id = 'simCanvas';
    this.app.canvas.style.borderRadius = '14px';
    this.app.canvas.style.touchAction = 'none';
    this.canvas.parentNode?.replaceChild(this.app.canvas, this.canvas);

    this.stage = this.app.stage;

    this.bgContainer = new Container();
    this.fxContainer = new Container();
    this.entityContainer = new Container();
    this.entityContainer.sortableChildren = true;
    this.jellyfishContainer = new Container();
    this.driftContainer = new Container();
    this.shaftContainer = new Container();
    this.bubbleContainer = new Container();
    this.stage.addChild(this.bgContainer);
    // Back to front: background, light shafts, motes, bubbles. Each plane leans further than the
    // one behind it, which is the whole of the parallax.
    this.stage.addChild(this.shaftContainer);
    this.stage.addChild(this.driftContainer);
    this.stage.addChild(this.bubbleContainer);
    this.stage.addChild(this.jellyfishContainer);
    this.stage.addChild(this.fxContainer);
    this.stage.addChild(this.entityContainer);

    // Over the entities, so a shark outside the pod's light is swallowed by it rather than
    // merely tinted, and under the storm overlay, which is weather rather than depth.
    this.gloomOverlay = new Sprite(makeVignetteTexture(512, 'rgb(1, 6, 16)'));
    this.gloomOverlay.anchor.set(0.5);
    this.gloomOverlay.visible = false;
    // Under the gloom: the arms are meant to be lost in it, and found by their lights instead.
    this.krakenContainer = new Container();
    this.stage.addChild(this.krakenContainer);

    this.stage.addChild(this.gloomOverlay);

    /**
     * A shark's own lights, lifted out of the entity layer and placed above the gloom.
     *
     * They used to be children of the shark's sprite, which put them under the vignette - so the
     * darkness that hides the body was painted over the lights too, at the level's own gloom
     * (0.62 in the Mesopelagic). The further a shark was from the pod, the more of its light the
     * overlay ate, which is the exact opposite of what carrying lights is for. Above the gloom
     * they read at full strength wherever the shark is, and the body stays hidden because that is
     * still drawn below.
     */
    this.lightsContainer = new Container();
    this.stage.addChild(this.lightsContainer);

    this.stormOverlay = new Graphics();
    this.stage.addChild(this.stormOverlay);

    // Screen shake and parallax both run on Pixi's render ticker (smooth 60fps), decoupled from
    // the ~80ms sim loop - at 12.5fps the parallax would visibly step rather than glide.
    this.app.ticker.add(() => {
      this.updateParallax();
      if (this.shakeTime > 0) {
        // Clamp so a resume from a backgrounded tab can't blow the whole shake in one frame.
        this.shakeTime -= Math.min(this.app.ticker.deltaMS, 50) / 1000;
        const m = Math.max(0, this.shakeTime / (SHAKE_DURATION_MS / 1000)) * this.shakeMagnitude;
        this.stage.position.set((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
      } else if (this.stage.x !== 0 || this.stage.y !== 0) {
        this.stage.position.set(0, 0);
      }
    });
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
    });

    this.buildMotes();
    this.buildShafts();
    this.buildBubbles();
    this.particles = new ParticleSystem(this.fxContainer);
    this.echoRing = new Graphics();
    this.fxContainer.addChild(this.echoRing);

    await this.createBackground();
    await this.loadSharkTextures();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig(), false, true);

    // Warm the Play Games sign-in state (no-op off Android) so the leaderboard
    // overlay can show a global rank without a round-trip delay.
    void playGames.ensureSignedIn();
  }

  /**
   * Sets the depth a Depthless run will begin at. Refused without access, so a tampered UI cannot
   * skip the purchase, and reset to 1 whenever the mode is chosen afresh.
   */
  setDepthlessStartLevel(level: number): boolean {
    const depth = Math.floor(level);
    if (this.mode !== 'endless' || !Number.isFinite(depth) || depth < 1) return false;
    if (!hasLevelAccess(depth)) return false;
    this.depthlessStartLevel = depth;
    return true;
  }

  /** The depth the current Depthless run began at, for the level select and the run summary. */
  getDepthlessStartLevel(): number {
    return this.depthlessStartLevel;
  }

  /** False when this run began at a bought depth, which bars it from the leaderboard. */
  private runIsRanked(): boolean {
    return this.mode !== 'endless' || startLevelIsRanked(this.depthlessStartLevel);
  }

  private getSelectedLevelConfig(): LevelConfig {
    if (this.mode === 'endless') return getLevelConfig(this.depthlessStartLevel);
    // The campaign starts where the campaign starts. It used to read a level picker sitting in
    // the game's own button bar, which let anyone open the game and jump straight to the
    // Matriarch; the Depthless campaign keeps its Level Select, where a depth is bought.
    return getLevelConfigForMode(1, 'campaign');
  }

  /** Sets which mode a fresh start/reset begins in. Campaign: pick a level 1-10, saves/resumes, ends at level 10. Endless: always starts at level 1, no free resume, continues past level 10 until death. */
  setMode(mode: GameMode): void {
    this.mode = mode;
    // Choosing a mode starts the choice over: a depth bought and used once should not silently
    // apply to every later dive, which would quietly bar a player from the leaderboard forever.
    this.depthlessStartLevel = 1;
  }

  private async loadSharkTextures(): Promise<void> {
    const sources: { kind: SharkKind; move: string; attack: string }[] = [
      { kind: 'greatWhite', move: `${ASSET_BASE}sharks/spr_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_shark_attack_strip9.png` },
      { kind: 'hammerhead', move: `${ASSET_BASE}sharks/spr_hammerhead_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_hammerhead_shark_attack_strip9.png` },
      { kind: 'tiger', move: `${ASSET_BASE}sharks/spr_tiger_shark_move_strip9.png`, attack: `${ASSET_BASE}sharks/spr_tiger_shark_attack_strip9.png` },
    ];

    await Promise.all(
      sources.map(async ({ kind, move, attack }) => {
        const [moveBase, attackBase] = await Promise.all([Assets.load(move), Assets.load(attack)]);
        this.sharkTextureSets[kind] = {
          move: sliceSharkStrip(moveBase),
          attack: sliceSharkStrip(attackBase),
        };
      })
    ).catch((err) => console.warn('Shark texture load failed:', err));
  }

  getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setKey(key: string, pressed: boolean): void {
    this.keys[key] = pressed;
  }

  setPointer(active: boolean, dirX?: number, dirY?: number): void {
    this.pointerActive = active;
    if (typeof dirX === 'number') this.pointerDirX = dirX;
    if (typeof dirY === 'number') this.pointerDirY = dirY;
  }

  /** 0 right after sprinting, ramping up to 1 once the cooldown has fully recharged - lets the UI
   * show a recharge indicator on the Sprint button instead of it just silently becoming usable. */
  /** Sprint duration in ms: the base plus the Store's Boost Duration upgrade. */
  /**
   * Starts a Boost if it is off cooldown, and reports whether one began.
   *
   * `announce` is off for a boost fired by a tap on the water: the ring around the dolphin
   * already says what happened, and a banner for something the player does every few seconds is
   * the kind of clutter the gesture exists to get rid of. The previous cooldown is kept so a tap
   * that turns out to be half of a double tap can be given back - see undoRecentBoost.
   */
  private startSprint(now: number, announce: boolean): boolean {
    if (now < this.sprintCooldownEnd) return false;
    this.sprintPrevCooldownEnd = this.sprintCooldownEnd;
    this.sprintStartedAt = now;
    this.sprinting = true;
    this.sprintEndTime = now + this.sprintDurationMs();
    this.sprintCooldownEnd = this.sprintEndTime + Math.max(3000, SPRINT_COOLDOWN - this.sprintCooldownReduction);
    this.setStatus('Sprint!');
    if (announce) this.showBanner('Sprint!', 'victory', 800);
    return true;
  }

  /** Boost, fired by a tap on the water rather than by holding the key. */
  boostNow(): boolean {
    if (!this.running || this.paused) return false;
    return this.startSprint(Date.now(), false);
  }

  /**
   * Hands back a Boost fired a moment ago, cooldown and all.
   *
   * A tap is Boost and a double tap is Echolocation, and the only way to tell them apart is to
   * wait - which would put a delay on the ability a player reaches for in a hurry. So the boost
   * fires at once and is taken back if a second tap lands, which costs the player the couple of
   * ticks of speed they already had rather than the whole cooldown.
   */
  undoRecentBoost(): void {
    if (Date.now() - this.sprintStartedAt > BOOST_UNDO_WINDOW_MS) return;
    this.sprinting = false;
    this.sprintEndTime = 0;
    this.sprintCooldownEnd = this.sprintPrevCooldownEnd;
  }

  private sprintDurationMs(): number {
    return SPRINT_DURATION + this.sprintDurationBonus;
  }

  /** Freeze-frame + light screen shake for a big kill. No-op under prefers-reduced-motion. */
  private triggerBigKillFeedback(impact: 'shark' | 'matriarch' = 'shark'): void {
    // Sound first: reduced motion should suppress the freeze-frame and the shake, not the hit.
    if (impact === 'matriarch') sfx.playMatriarchHit();
    else sfx.playBigKill();
    if (this.reducedMotion) return;
    this.hitStopUntil = Date.now() + HIT_STOP_MS;
    this.shakeMagnitude = SHAKE_MAGNITUDE;
    this.shakeTime = SHAKE_DURATION_MS / 1000;
  }

  /** Plays the kill blip, bumping the combo (and its pitch) unless too long since the last kill. */
  private registerKillSound(): void {
    if (this.gameTime - this.lastKillTime > COMBO_RESET_SECONDS) this.killCombo = 0;
    this.killCombo++;
    this.lastKillTime = this.gameTime;
    sfx.playSharkKill(this.killCombo - 1);
  }

  private resetKillCombo(): void {
    this.killCombo = 0;
    this.lastKillTime = 0;
  }

  /**
   * The stat bonuses in effect this run, for the "Your Dolphin" panel. Null when no run is in
   * progress, which is what tells the panel to leave the section out entirely rather than showing
   * a row of zeroes on the title screen.
   *
   * Where they came from depends on the mode, hence reporting it: in the Campaign they are the
   * Mega Shrimp picks made during the run and nothing else, and in the Depthless Campaign they
   * are the Store upgrades and nothing else.
   */
  runUpgrades(): {
    mode: GameMode;
    lives: number;
    speedBonusPct: number;
    podBonus: number;
    boostReductionMs: number;
  } | null {
    if (this.sessionStartTime === 0) return null;
    return {
      mode: this.mode,
      lives: this.vitalityLives,
      speedBonusPct: this.speedBonusPct,
      podBonus: this.charismaBonusDolphins,
      boostReductionMs: this.sprintCooldownReduction,
    };
  }

  /** How many Magic Shrimp the player is carrying, for the in-run button. */
  magicShrimpCount(): number {
    return magicShrimpHeld();
  }

  /** Everything the player is carrying, for the in-run buttons. */
  consumableCounts(): Inventory {
    return getInventory();
  }

  /** True while a Ghost Shrimp is hiding the pod. */
  isGhosted(): boolean {
    return Date.now() < this.ghostUntil;
  }

  /** Shared guard: a consumable can only be spent during live play. */
  private canUseConsumable(): boolean {
    return this.running && !this.paused && !!this.player;
  }

  /**
   * Spends a Magic Shrimp for extra swim speed lasting the rest of the level. Bought in the Store
   * rather than found in the water: as a pickup it was a coin flip that could just as easily hand
   * the boost to a shark and turn it large, which was punishment with no counterplay.
   *
   * They stack, so spending a second one during a bad level is a real option rather than a waste.
   */
  useMagicShrimpItem(): boolean {
    if (!this.running || this.paused || !this.player) return false;
    if (!useConsumable('magicShrimp')) return false;

    this.shrimpSpeedBonus += SHRIMP_SPEED_BONUS;
    // Still flags "boosted" for the ring and the quicker fluke beat; the magnitude now comes
    // from shrimpSpeedBonus rather than from this being a yes/no.
    this.player.speedBoostUntil = Number.MAX_SAFE_INTEGER;

    const scale = WORLD_SCALE;
    this.particles.emit('sparkle', this.player._x * scale + scale / 2, this.player._y * scale + scale / 2, 18, {
      speed: 2,
      life: 0.8,
    });
    sfx.playShrimp();
    const percent = Math.round(this.shrimpSpeedBonus * 100);
    this.setStatus(`+${percent}% speed for the level!`);
    this.showBanner(`Magic Shrimp! +${percent}%`, 'statup', 1400);
    this.onConsumableChange?.(getInventory());
    return true;
  }

  /**
   * Spends a Ghost Shrimp: for thirty seconds no shark can find the pod, and none can take a
   * dolphin from it. Sharks are not frozen - they cruise and search, so the water still feels
   * alive - they simply have nothing to converge on, which is what makes it read as hiding
   * rather than as a pause button.
   *
   * Stacking would only extend an effect that is already long, so a second one spent while the
   * first is running is refused rather than wasted.
   */
  useGhostShrimpItem(): boolean {
    if (!this.canUseConsumable() || !this.player) return false;
    if (this.isGhosted()) {
      this.setStatus('Already hidden');
      return false;
    }
    if (!useConsumable('ghostShrimp')) return false;

    this.ghostUntil = Date.now() + GHOST_DURATION_MS;
    // Every shark loses the trail it was on, so the pod is not still being tracked by a shark
    // that happened to be mid-charge.
    for (const shark of this.sharks) {
      shark.charging = false;
      shark.ambushing = false;
      shark.stalking = false;
    }

    const scale = WORLD_SCALE;
    this.particles.emit('bubble', this.player._x * scale + scale / 2, this.player._y * scale + scale / 2, 24, {
      speed: 2.4,
      life: 1.1,
    });
    sfx.playGhostShrimp();
    this.setStatus('Hidden from the sharks!');
    this.showBanner('Ghost Shrimp!', 'statup', 1600);
    this.onConsumableChange?.(getInventory());
    return true;
  }

  /**
   * Spends a Pistol Shrimp: a shockwave that throws every nearby shark clear of the pod and
   * leaves it tumbling for a few seconds. It breaks charges and lunges already in flight, which
   * is the whole point of carrying one - it is the answer to being swarmed at the wrong moment.
   *
   * Refused outright when nothing is in range, so a mistimed tap does not burn 75 Pearls on
   * empty water.
   */
  usePistolShrimpItem(): boolean {
    if (!this.canUseConsumable() || !this.player) return false;

    const inRange = this.sharks.filter((s) => s.distanceBetween(this.player!) <= PISTOL_BLAST_RADIUS);
    if (inRange.length === 0) {
      this.setStatus('No sharks in range');
      return false;
    }
    if (!useConsumable('pistolShrimp')) return false;

    const now = Date.now();
    for (const shark of inRange) {
      const awayX = directionDelta(shark._x, this.player._x);
      const awayY = shark._y - this.player._y;
      const len = Math.hypot(awayX, awayY);
      // A shark sitting exactly on the player has no direction to be thrown in; pick one.
      const angle = len > 0.001 ? Math.atan2(awayY, awayX) : Math.random() * Math.PI * 2;
      shark.stunDx = Math.cos(angle);
      shark.stunDy = Math.sin(angle);
      shark.stunnedUntil = now + PISTOL_STUN_MS;
      shark.charging = false;
      shark.ambushing = false;
      shark.stalking = false;
      // The blast gives a cloaked tiger away, the same as feeding does.
      this.revealShark(shark, now);
    }

    const scale = WORLD_SCALE;
    this.particles.emit('sparkle', this.player._x * scale + scale / 2, this.player._y * scale + scale / 2, 30, {
      speed: 5,
      life: 0.7,
    });
    sfx.playPistolShrimp();
    if (!this.reducedMotion) {
      this.shakeMagnitude = SHAKE_MAGNITUDE;
      this.shakeTime = SHAKE_DURATION_MS / 1000;
    }
    const many = inRange.length > 1;
    this.setStatus(many ? `${inRange.length} sharks stunned!` : 'Shark stunned!');
    this.showBanner('Pistol Shrimp!', 'statup', 1400);
    this.onConsumableChange?.(getInventory());
    return true;
  }

  /** Spends one of any kind, for the shared HUD button handler. */
  useConsumableItem(id: ConsumableId): boolean {
    if (id === 'magicShrimp') return this.useMagicShrimpItem();
    if (id === 'ghostShrimp') return this.useGhostShrimpItem();
    return this.usePistolShrimpItem();
  }

  /** True while a ping is lighting the water up. */
  isEcholocating(): boolean {
    return Date.now() < this.echoEndTime;
  }

  /** Whether the player has Echolocation available in this run at all (bought, and in Endless). */
  hasEcholocation(): boolean {
    return this.echoAvailable;
  }

  /** 0..1 recharge progress, 1 when ready. Mirrors getSprintCooldownFraction for the button ring. */
  getEchoCooldownFraction(): number {
    const now = Date.now();
    if (!this.echoAvailable || now >= this.echoCooldownEnd) return 1;
    const total = this.echoDurationMs + this.echoCooldownMs;
    const startedAt = this.echoCooldownEnd - total;
    return Math.max(0, Math.min(1, (now - startedAt) / total));
  }

  /** Fires a ping if one is available. Returns false when unavailable or still recharging. */
  echolocate(): boolean {
    const now = Date.now();
    if (!this.echoAvailable || !this.running || this.paused) return false;
    if (now < this.echoCooldownEnd) return false;
    this.echoStartedAt = now;
    this.echoEndTime = now + this.echoDurationMs;
    this.echoCooldownEnd = this.echoEndTime + this.echoCooldownMs;
    sfx.playEcho();
    this.setStatus('Echolocation!');
    return true;
  }

  /**
   * Whether a shark that would otherwise be hidden is inside the current ping. Only ever widens
   * visibility - it never hides a shark that would have been drawn anyway.
   */
  private sharkRevealedByEcho(shark: Shark): boolean {
    if (!this.player || !this.isEcholocating()) return false;
    return shark.distanceBetween(this.player) <= this.echoRadius;
  }

  /** How far the pod can see unaided at this depth. The whole screen, in water with no gloom. */
  private gloomSightRadius(): number {
    return GLOOM_SIGHT_LIT - (GLOOM_SIGHT_LIT - GLOOM_SIGHT_DARK) * this.levelGloom;
  }

  /**
   * How far a particular shark can be made out, which is not the same for all of them.
   *
   * The sight radius used to be flat, so at depth a grown hammerhead and a juvenile cookiecutter
   * appeared at exactly the same distance - and since the shallow-water species carry no
   * photophores, the big ones arrived out of nothing with no warning at all. A large shark is a
   * far bigger object; it should resolve out of the dark sooner, the way it would.
   *
   * Scaled by the square root of how large it is drawn, so the advantage grows with size but
   * never runs away with it, and bounded at both ends: nothing is visible less than four fifths
   * of the way out, and nothing is visible more than twice. On level 17, where the pod sees about
   * sixteen units, a grown hammerhead now resolves at about thirty - a warning rather than a
   * bite - while a juvenile cookiecutter still has to get to twelve, which is its whole character.
   */
  private sharkSightRadius(shark: Shark): number {
    const drawScale = SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
    const size = Math.max(0.8, Math.min(2, Math.sqrt(drawScale)));
    return this.gloomSightRadius() * size;
  }

  getSprintCooldownFraction(): number {
    const now = Date.now();
    if (now >= this.sprintCooldownEnd) return 1;
    const total = this.sprintDurationMs() + Math.max(3000, SPRINT_COOLDOWN - this.sprintCooldownReduction);
    const startedAt = this.sprintCooldownEnd - total;
    return Math.max(0, Math.min(1, (now - startedAt) / total));
  }

  /**
   * Leaves the run and hands control back to the title screen. Unlike reset() this deliberately
   * keeps any campaign checkpoint, so "Continue Campaign" still picks the run back up - quitting
   * from the pause menu should not throw the campaign away.
   */
  leaveToMenu(): void {
    // Tear the pause overlay down directly rather than via resumeGame(), which would restart the
    // loop for a tick on the way out.
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig(), false, true);
    this.setStatus('Ready');
    this.startBtn.textContent = 'Start';
  }

  reset(): void {
    this.running = false;
    this.onMusicResume?.();
    if (this.timer) clearTimeout(this.timer);
    clearRunCheckpoint();
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig(), false, true);
    this.setStatus('Ready');
    this.startBtn.textContent = 'Start';
  }

  /**
   * Rebuilds the idle water at the depth the next run will begin from.
   *
   * Called when a level is chosen rather than when it is started, so the screen behind the Start
   * button is the level that was picked. Without it the player looked at level 1 - its
   * background, its sharks and its introduction cards - and only arrived at the depth they chose
   * once they pressed Start.
   */
  showSelectedLevel(): void {
    this.createEnvironment();
    this.initModel(this.getSelectedLevelConfig(), false, true);
    this.setStatus('Ready');
    this.startBtn.textContent = 'Start';
  }

  /**
   * The Start / Restart / Retry button. On the first press of a session (also true right
   * after Reset) this begins a fresh run at the picked level; every later press is a genuine
   * retry of the current level with upgrades and run stats kept.
   */
  retry(): void {
    // The Depthless Campaign has no resume, so a retry there is always a new descent from the
    // chosen depth rather than a second go at the level that just ended. Resuming at the level
    // the player died on, with their progress intact and the run still counted, meant one deep
    // level could be farmed for a leaderboard score indefinitely - which is the opposite of what
    // the board is for, and undid the rule that keeps bought starting depths off it.
    const freshRun = this.sessionStartTime === 0 || this.mode === 'endless';
    const config = freshRun ? this.getSelectedLevelConfig() : getLevelConfigForMode(this.currentLevel, this.mode);
    if (!this.initModel(config, !freshRun)) return;
    if (freshRun) this.sessionStartTime = Date.now();
    else this.retries++;
    this.running = true;
    // Retrying after a game over is the common case, and the music is stopped by then.
    this.onMusicResume?.();
    this.startBtn.textContent = freshRun ? 'Restart' : 'Retry';
    this.setStatus('Swimming');
    this.step();
  }

  /** Restores a checkpoint saved by a previous session and resumes play at that level. */
  resumeRun(checkpoint: RunCheckpoint): boolean {
    this.mode = 'campaign';
    this.vitalityLives = checkpoint.vitalityLives;
    this.speedBonusPct = checkpoint.speedBonusPct;
    this.charismaBonusDolphins = checkpoint.charismaBonusDolphins;
    this.sprintCooldownReduction = checkpoint.sprintCooldownReduction;
    this.retries = checkpoint.retries;
    this.totalRecruited = checkpoint.totalRecruited;
    this.totalLost = checkpoint.totalLost;
    this.sharksKilled = checkpoint.sharksKilled;
    // Kills up to the checkpoint were already added to the lifetime total last session.
    this.syncedSharkKills = checkpoint.sharksKilled;
    this.totalDolphinsSaved = checkpoint.totalDolphinsSaved;
    this.seenSharkKinds = new Set(checkpoint.seenSharkKinds);
    // Absent from checkpoints written before small-before-large existed; an empty set just means
    // the first level back falls through to its own small sharks, which is the safe direction.
    this.seenSmallSharkKinds = new Set(checkpoint.seenSmallSharkKinds ?? []);
    this.seenLargeSharkKinds = new Set(checkpoint.seenLargeSharkKinds);
    this.seenLargeSharkVariety = checkpoint.seenLargeSharkVariety;

    if (!this.initModel(getLevelConfigForMode(checkpoint.level, 'campaign'), true)) return false;
    this.sessionStartTime = Date.now();
    this.runElapsed = checkpoint.elapsedSeconds;
    this.running = true;
    this.startBtn.textContent = 'Retry';
    this.setStatus('Swimming');
    this.step();
    return true;
  }

  private saveCheckpoint(): void {
    saveRunCheckpoint({
      level: this.currentLevel,
      vitalityLives: this.vitalityLives,
      speedBonusPct: this.speedBonusPct,
      charismaBonusDolphins: this.charismaBonusDolphins,
      sprintCooldownReduction: this.sprintCooldownReduction,
      retries: this.retries,
      totalRecruited: this.totalRecruited,
      totalLost: this.totalLost,
      sharksKilled: this.sharksKilled,
      totalDolphinsSaved: this.totalDolphinsSaved,
      elapsedSeconds: this.runElapsed,
      seenSharkKinds: [...this.seenSharkKinds],
      seenSmallSharkKinds: [...this.seenSmallSharkKinds],
      seenLargeSharkKinds: [...this.seenLargeSharkKinds],
      seenLargeSharkVariety: this.seenLargeSharkVariety,
    });
  }

  togglePause(): void {
    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Snapshot of loop/gate state for the ?diag on-screen readout (see main.ts). */
  debugSnapshot(): Record<string, unknown> {
    return {
      running: this.running,
      paused: this.paused,
      loopTimer: !!this.timer,
      mode: this.mode,
      level: this.currentLevel,
      sharks: this.sharks.length,
      dolphins: this.dolphins.length,
      pod: this.getPodSize(),
      gameTime: Math.round(this.gameTime * 10) / 10,
      activeEvent: this.activeEvent?.type ?? null,
      awaiting: [
        this.awaitingSharkWarning && 'sharkWarning',
        this.awaitingTutorialHint && 'tutorialHint',
        this.awaitingLevelUpChoice && 'levelUp',
        this.awaitingRunSummary && 'runSummary',
        this.awaitingMilestone && 'milestone',
        this.awaitingContinue && 'continue',
        this.awaitingNewWaters && 'newWaters',
      ].filter(Boolean),
      hitStopMs: Math.max(0, this.hitStopUntil - Date.now()),
    };
  }

  formSchool(): void {
    if (!this.readyToSchool || this.huntingMode || this.activeEvent?.type === 'jellyfish') return;
    this.huntingMode = true;
    this.readyToSchool = false;
    this.schoolBtnWrap.classList.add('hidden');
    this.setStatus('HUNTING MODE: ram sharks to destroy them');
    this.updateHuntingVisuals();
    this.onSchoolingChange?.(true);
    this.queueTutorialHint(
      'huntingMode',
      'Hunting Mode!',
      "Swim into a shark to ram and destroy it. The number above each shark is the pod size you need - it turns green once you're strong enough."
    );
  }

  /** Calls in every dolphin saved across the campaign so far to join the pod for the final push on
   * the Matriarch. She isn't defeated on summon - the player has to sprint the Mega Pod into her
   * MATRIARCH_HITS_REQUIRED times (see the hunting-mode kill loop in step()) for the finishing blow. */
  summonMegaPod(): void {
    if (!this.megaPodAvailable || !this.player) return;
    this.megaPodAvailable = false;
    this.megaPodBtnWrap?.classList.add('hidden');
    this.tryUnlock('megaPod');

    const count = this.totalDolphinsSaved;
    for (let i = 0; i < count; i++) {
      this.spawnRecruitedDolphin(this.player._x, this.player._y);
    }
    sfx.playRecruit();
    this.setStatus(count > 0 ? `Mega Pod summoned! +${count} dolphins` : 'Mega Pod summoned!');
    this.showBanner('Mega Pod Summoned!', 'victory', 1800);

    this.megaPodActive = true;
    this.matriarchHitsTaken = 0;
    this.matriarchHitCooldownUntil = 0;
  }

  /** Briefly flashes the Matriarch's sprite to acknowledge a Mega Pod ram that didn't finish her off. */
  private flashMatriarchHit(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    const fish = sprite?.getChildByName('fish') as unknown as { tint: number } | undefined;
    if (!fish) return;
    [0xff4444, 0xffffff, 0xff4444, 0xffffff].forEach((tint, i) => {
      setTimeout(() => {
        if (this.sharkSprites.get(shark) === sprite) fish.tint = tint;
      }, i * 90);
    });
  }

  /** The Mega Pod's finishing blow, once the Matriarch has taken MATRIARCH_HITS_REQUIRED sprinting rams. */
  private finishMatriarchWithMegaPod(): void {
    if (!this.matriarch) return;
    this.megaPodActive = false;
    const scale = WORLD_SCALE;
    this.particles.emit('hit', this.matriarch._x * scale + scale / 2, this.matriarch._y * scale + scale / 2, 24, {
      speed: 4,
      life: 0.8,
    });
    this.sharksKilled++;
    this.playSharkDeathAnimation(this.matriarch);
    this.tryUnlock('matriarchSlayer');
    this.setStatus('The Matriarch is defeated!');
    this.showBanner('Matriarch Defeated!', 'victory', 1800);
    this.levelComplete();
  }

  private pauseGame(): void {
    if (!this.running || this.paused || this.awaitingLevelUpChoice || this.awaitingSharkWarning || this.awaitingRunSummary || this.awaitingTutorialHint || this.awaitingMilestone || this.awaitingContinue) return;
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
    this.setStatus('Paused');
    this.pauseOverlayEl.classList.remove('hidden');
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.setStatus('Swimming');
    this.lastFrameTime = 0;
    this.step();
  }

  private setStatus(text: string): void {
    this.statStatus.textContent = text;
  }

  private showBanner(
    text: string,
    type: 'gameover' | 'victory' | 'recruited' | 'lost' | 'storm' | 'levelup' | 'statup',
    duration?: number
  ): void {
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    this.bannerEl.textContent = text;
    this.bannerEl.className = `game-banner visible ${type}`;
    if (duration) {
      this.bannerTimeout = setTimeout(() => {
        this.bannerEl.classList.remove('visible');
      }, duration);
    }
  }

  private hideBanner(): void {
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    this.bannerEl.classList.remove('visible');
  }

  private updateHuntingVisuals(): void {
    const wrap = this.app.canvas.parentElement;
    if (wrap) wrap.classList.toggle('hunting', this.huntingMode);
  }

  private async createBackground(): Promise<void> {
    await this.loadBackground(`${ASSET_BASE}OpenOceanBGImage.webp`);
  }

  /**
   * The near parallax plane: specks of drifting matter, the sort that catches the light in any
   * underwater shot. Spawned across an area larger than the canvas so the plane can lean without
   * running out of motes at the edges, and each one rises at its own pace so the field never
   * looks like a single sheet sliding about.
   */
  /**
   * Eases the two planes toward the camera's current lean and drifts the motes upward. Runs every
   * rendered frame. The lean itself is set by the sim loop; here it is only smoothed and applied,
   * so a slow tick rate never shows as stepping.
   */
  private updateParallax(): void {
    const seconds = Math.min(this.app.ticker.deltaMS, 50) / 1000;

    if (this.reducedMotion) {
      this.bgContainer.position.set(0, 0);
      this.shaftContainer.position.set(0, 0);
      this.driftContainer.position.set(0, 0);
      this.bubbleContainer.position.set(0, 0);
      if (this.bgSprite) this.bgSprite.scale.set(this.bgBaseScale);
      return;
    }

    // A slow figure-of-eight so the scene still breathes while the player is holding still.
    const t = performance.now() / 1000;
    const ambientX = Math.sin(t * 0.06) * 0.3;
    const ambientY = Math.cos(t * 0.045) * 0.22;

    const targetX = (this.parallaxLeanX + ambientX) * BG_PARALLAX_PX;
    const targetY = (this.parallaxLeanY + ambientY) * BG_PARALLAX_PX;
    // Framerate-independent easing, so the glide is the same on a 60Hz and a 120Hz screen.
    const ease = 1 - Math.pow(0.02, seconds);
    this.parallaxX += (targetX - this.parallaxX) * ease;
    this.parallaxY += (targetY - this.parallaxY) * ease;

    this.bgContainer.position.set(this.parallaxX, this.parallaxY);
    this.shaftContainer.position.set(
      this.parallaxX * SHAFT_PARALLAX_FACTOR,
      this.parallaxY * SHAFT_PARALLAX_FACTOR,
    );
    this.driftContainer.position.set(
      this.parallaxX * NEAR_PARALLAX_FACTOR,
      this.parallaxY * NEAR_PARALLAX_FACTOR,
    );
    this.bubbleContainer.position.set(
      this.parallaxX * BUBBLE_PARALLAX_FACTOR,
      this.parallaxY * BUBBLE_PARALLAX_FACTOR,
    );

    // Push-in. Exponential ease, so it moves most in the opening seconds of a level and then
    // keeps creeping without ever arriving.
    if (this.bgSprite) {
      const elapsed = (performance.now() - this.bgPlacedAt) / 1000;
      const progress = 1 - Math.exp(-elapsed / BG_PUSH_IN_TAU);
      this.bgSprite.scale.set(this.bgBaseScale * (1 + BG_PUSH_IN * progress));
    }

    const wrapSpan = CANVAS_W * NEAR_PARALLAX_FACTOR * 0.14;
    for (const mote of this.motes) {
      mote.gfx.y -= mote.speed * seconds;
      mote.gfx.x += Math.sin(t * 0.3 + mote.phase) * mote.sway * seconds;
      if (mote.gfx.y < -wrapSpan) {
        mote.gfx.y = CANVAS_H + wrapSpan;
        mote.gfx.x = -wrapSpan + Math.random() * (CANVAS_W + wrapSpan * 2);
      }
    }

    // Shafts slide and breathe rather than travelling, so the light stays where the surface is.
    for (const shaft of this.shafts) {
      shaft.gfx.x = shaft.baseX + Math.sin(t * 0.07 + shaft.phase) * shaft.sway;
      shaft.gfx.alpha = 0.65 + Math.sin(t * 0.11 + shaft.phase * 1.7) * 0.35;
    }

    const bubbleSpan = CANVAS_W * BUBBLE_PARALLAX_FACTOR * 0.14;
    for (const bubble of this.bubbles) {
      bubble.gfx.y -= bubble.speed * seconds;
      bubble.gfx.x += Math.sin(t * 1.1 + bubble.phase) * bubble.sway * seconds;
      if (bubble.gfx.y < -bubbleSpan - bubble.radius) {
        bubble.gfx.y = CANVAS_H + bubbleSpan + bubble.radius;
        bubble.gfx.x = -bubbleSpan + Math.random() * (CANVAS_W + bubbleSpan * 2);
      }
    }
  }

  private buildMotes(): void {
    this.driftContainer.removeChildren();
    this.motes = [];
    const spread = CANVAS_W * NEAR_PARALLAX_FACTOR * 0.14;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const gfx = new Graphics();
      const radius = 0.8 + Math.random() * 2.2;
      gfx.circle(0, 0, radius).fill({ color: 0xdff3ff, alpha: 0.1 + Math.random() * 0.22 });
      gfx.x = -spread + Math.random() * (CANVAS_W + spread * 2);
      gfx.y = -spread + Math.random() * (CANVAS_H + spread * 2);
      this.driftContainer.addChild(gfx);
      this.motes.push({
        gfx,
        speed: 2 + Math.random() * 7,
        sway: 3 + Math.random() * 9,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Shafts of light angled down from the surface. Built once and reused for every level rather
   * than per background, because they are a property of water rather than of any one scene -
   * which is also what makes them apply to every level of both modes without any per-level work.
   */
  private buildShafts(): void {
    this.shaftContainer.removeChildren();
    this.shafts = [];
    const overhang = 140;
    for (let i = 0; i < SHAFT_COUNT; i++) {
      const gfx = new Graphics();
      const topWidth = 26 + Math.random() * 44;
      const spread = 30 + Math.random() * 70;
      // Leaning the same way for all of them reads as one sun overhead, rather than as several.
      const drop = CANVAS_H + overhang * 2;
      const lean = drop * (0.22 + Math.random() * 0.16);
      const alpha = 0.05 + Math.random() * 0.06;
      gfx
        .poly([0, -overhang, topWidth, -overhang, lean + topWidth + spread, drop - overhang, lean - spread, drop - overhang])
        .fill({ color: 0xcdefff, alpha });
      gfx.blendMode = 'add';
      const baseX = -120 + (i + Math.random() * 0.6) * ((CANVAS_W + 240) / SHAFT_COUNT);
      gfx.x = baseX;
      this.shaftContainer.addChild(gfx);
      this.shafts.push({ gfx, baseX, sway: 10 + Math.random() * 26, phase: Math.random() * Math.PI * 2, alpha });
    }
  }

  /**
   * Bubbles rising on the nearest plane. Bigger and faster than the motes and drawn as rings with
   * a highlight, so the two fields read as different things at different distances instead of one
   * speckled sheet.
   */
  private buildBubbles(): void {
    this.bubbleContainer.removeChildren();
    this.bubbles = [];
    const spread = CANVAS_W * BUBBLE_PARALLAX_FACTOR * 0.14;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const radius = 1.6 + Math.random() * 4.4;
      const gfx = new Graphics();
      gfx.circle(0, 0, radius).fill({ color: 0xd8f4ff, alpha: 0.1 + Math.random() * 0.12 });
      gfx.circle(0, 0, radius).stroke({ width: 1, color: 0xeafaff, alpha: 0.3 + Math.random() * 0.25 });
      gfx.circle(-radius * 0.3, -radius * 0.35, Math.max(0.5, radius * 0.28)).fill({ color: 0xffffff, alpha: 0.5 });
      gfx.x = -spread + Math.random() * (CANVAS_W + spread * 2);
      gfx.y = -spread + Math.random() * (CANVAS_H + spread * 2);
      this.bubbleContainer.addChild(gfx);
      this.bubbles.push({
        gfx,
        radius,
        // Bigger bubbles rise faster, the way they actually do.
        speed: 14 + radius * 5 + Math.random() * 12,
        sway: 5 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private async loadBackground(url: string): Promise<void> {
    const texture = await Assets.load(url);
    const bg = new Sprite(texture);

    // Overscanned, so the parallax lean never drags an edge into view.
    const scale = Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height) * BG_OVERSCAN;
    bg.anchor.set(0.5);
    bg.scale.set(scale);
    bg.position.set(CANVAS_W / 2, CANVAS_H / 2);

    this.bgContainer.removeChildren();
    this.bgContainer.addChild(bg);
    // The push-in restarts with each background, so every level opens wide and closes in.
    this.bgSprite = bg;
    this.bgBaseScale = scale;
    this.bgPlacedAt = performance.now();
  }

  private createEnvironment(): void {
    this.environment = [];
    for (let y = 0; y < SIZE_Y; y++) {
      const row: number[] = [];
      for (let x = 0; x < SIZE_X; x++) {
        row.push(Math.floor(Math.random() * 100));
      }
      this.environment.push(row);
    }
  }

  private findSafestCorner(): { x: number; y: number } {
    const margin = 8;
    const yMin = 12;
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      candidates.push({
        x: Math.floor(margin + Math.random() * (SIZE_X - margin * 2)),
        y: Math.floor(yMin + Math.random() * (SIZE_Y - yMin - margin)),
      });
    }
    let best = candidates[0];
    let bestDist = 0;
    for (const c of candidates) {
      let minDist = Infinity;
      for (const shark of this.sharks) {
        const d = Math.sqrt((shark._x - c.x) ** 2 + (shark._y - c.y) ** 2);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) {
        bestDist = minDist;
        best = c;
      }
    }
    return best;
  }

  private spawnRecruitableDolphin(): void {
    const corner = this.findSafestCorner();
    const dolphin = new Dolphin(this.dolphins.length, corner.y, corner.x);
    this.dolphins.push(dolphin);
    this.addDolphinSprite(dolphin);
    this.setStatus('A lost dolphin appeared');
  }

  /** Adds an already-recruited dolphin directly to the pod (bonus/summoned dolphins, not found-and-swum-to). */
  private spawnRecruitedDolphin(x: number, y: number): void {
    const dolphin = new Dolphin(this.dolphins.length, y, x);
    dolphin.recruited = true;
    this.totalRecruited++;
    this.dolphins.push(dolphin);
    this.addDolphinSprite(dolphin);
  }

  /**
   * Builds the water for a level.
   *
   * `silent` is for the model that sits on screen before anyone has pressed Start. That model
   * exists only so the player can see where they are about to dive, and a shark-introduction
   * card belongs to a run rather than to a preview - shown here it fires once for the idle
   * level and then again the moment the run actually begins.
   */
  private initModel(config = LEVELS[0], keepUpgrades = false, silent = false): boolean {
    this.entityContainer.removeChildren();
    this.lightsContainer.removeChildren();
    this.dolphinSprites.clear();
    this.sharkSprites.clear();
    this.sharkLights.clear();
    this.particles.clear();

    this.dolphins = [];
    const px = Math.floor(SIZE_X / 2);
    const py = Math.floor(SIZE_Y / 2);
    this.player = new Dolphin(0, py, px);
    this.player.isPlayer = true;
    this.player.invulnerableUntil = Date.now() + LEVEL_START_INVULNERABILITY_MS;
    this.pendingLevelInvulnerability = true;
    this.shrimpSpeedBonus = 0;
    this.ghostUntil = 0;
    this.dolphins.push(this.player);
    this.addDolphinSprite(this.player);

    if (!keepUpgrades) {
      this.vitalityLives = 0;
      this.speedBonusPct = 0;
      this.charismaBonusDolphins = 0;
      this.sprintCooldownReduction = 0;
      this.sprintDurationBonus = 0;
      this.podResponsiveness = 0;
      this.ironSkin = false;
      this.seenSharkKinds = new Set<SharkKind>();
      this.seenSmallSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkKinds = new Set<SharkKind>();
      this.seenLargeSharkVariety = false;
      this.retries = 0;
      // One megamouth a descent, on a level rolled here at the top of the run so the zone is
      // never quite the same shape twice.
      this.megamouthRunLevel =
        MEGAMOUTH_ENCOUNTER_FIRST_LEVEL +
        Math.floor(Math.random() * (MEGAMOUTH_ENCOUNTER_LAST_LEVEL - MEGAMOUTH_ENCOUNTER_FIRST_LEVEL + 1));
      this.megamouthDone = false;
      this.totalRecruited = 0;
      this.totalLost = 0;
      this.sharksKilled = 0;
      this.sessionStartTime = 0;
      this.runElapsed = 0;
      this.totalDolphinsSaved = 0;
      this.lastMusicLevel = 0;
      this.syncedSharkKills = 0;
      this.lastBoostNudgeTime = 0;
      this.pearlsThisRun = 0;
      this.pearlsDoubledThisRun = false;
      this.achievementsThisRun = [];
      this.unsyncedPlaySeconds = 0;
      this.lifetimeFlushAt = 20;
      this.playDayRecorded = false;
      this.leaderboardOverlayEl?.classList.add('hidden');

      // Endless only: the Store's permanent upgrades seed this run's starting stats;
      // and they are the whole of it - the Depthless Campaign has no Mega Shrimp picks.
      if (this.mode === 'endless') {
        const b = endlessStartBonuses();
        this.vitalityLives = b.vitalityLives;
        this.speedBonusPct = b.speedBonusPct;
        this.charismaBonusDolphins = b.charismaBonusDolphins;
        this.sprintCooldownReduction = b.sprintCooldownReduction;
        this.podResponsiveness = b.responsiveness;
        this.ironSkin = ownsIronSkin();
        this.sprintDurationBonus = b.sprintDurationBonus;

        // A dark depth is dark on purpose and Echolocation is the answer to it, so two cases hand
        // the ability over whether or not it has been bought: a sandbox, which would otherwise be
        // untestable, and a dive that was started from Level Select at the first dark depth or
        // deeper. The second matters because Echolocation cannot be bought until the campaign has
        // been cleared, while a starting depth costs only Pearls - without this, a player can pay
        // for a depth they have no way to equip for.
        //
        // Only a dive that BEGINS down there is lent it. Descending into the dark from level 1 is
        // a run that has had the whole campaign to earn the ability, and taking it as a gift at
        // level 11 would undercut both the purchase and the descent.
        const owned = ownsEcholocation();
        const lent =
          !owned && (isSandboxLevel(config.level) || this.depthlessStartLevel >= ECHO_LENT_FROM_LEVEL);
        // Lent Echolocation is the base ability, never the bought upgrades - see store.ts.
        const echo = lent ? baseEcholocationStats() : echolocationStats();
        this.echoAvailable = owned || lent;
        // And it starts you with a pod rather than alone. A single dolphin in black water dies
        // in about five seconds, and every shark worth testing has to be rammed by a pod that
        // meets its number - a bench you cannot fight on tests nothing.
        if (isSandboxLevel(config.level)) {
          this.charismaBonusDolphins = Math.max(this.charismaBonusDolphins, SANDBOX_STARTING_POD);
        }
        this.echoDurationMs = echo.durationMs;
        this.echoCooldownMs = echo.cooldownMs;
        this.echoRadius = echo.radius;
      } else {
        this.echoAvailable = false;
      }
      this.echoEndTime = 0;
      this.echoCooldownEnd = 0;
      this.onEchoAvailabilityChange?.(this.echoAvailable);
      this.onConsumableChange?.(getInventory());
    }
    this.wasOnLastLifeThisLevel = false;

    for (let i = 0; i < this.charismaBonusDolphins; i++) {
      this.spawnRecruitedDolphin(px, py);
    }

    this.currentLevel = config.level;
    this.sharks = [];
    this.gameTime = 0;
    this.lostThisLevel = 0;
    this.spawnSharksForLevel(config);
    this.draw();

    this.nextDolphinSpawnTime = this.dolphinSpawnInterval;
    this.lastFrameTime = 0;
    this.podHeading = 0;
    this.playerHitCooldownUntil = 0;
    this.hideBanner();
    this.activeEvent = null;
    // A bench gets its first event a few seconds in rather than after a full minute, and the
    // order starts over with the level so the same thing is always first out of the gate.
    const bench = isSandboxLevel(config.level);
    this.nextEventCheckTime = bench ? BENCH_FIRST_EVENT_AT : EVENT_CHECK_INTERVAL;
    this.benchEventIndex = 0;
    this.pendingEvent = null;
    this.eventWarningShown = false;
    this.planNextEvent();
    this.clearJellyfish();
    // Both hold sprites of their own, so a level that ends mid-event would otherwise leave an arm
    // hanging in the water or a megamouth parked in the next level's arena.
    this.clearKraken();
    this.clearMegamouth();
    this.stormOverlay.clear();
    sfx.stopStormRumble();
    if (this.levelCompleteTimer) {
      clearTimeout(this.levelCompleteTimer);
      this.levelCompleteTimer = null;
    }
    this.levelCompleted = false;
    this.autoFormedForThisPod = false;
    this.sprinting = false;
    this.sprintEndTime = 0;
    this.sprintCooldownEnd = 0;
    this.resetKillCombo();
    this.hitStopUntil = 0;
    this.shakeTime = 0;
    this.stage?.position.set(0, 0);
    this.awaitingNewWaters = false;
    this.newWatersPromptEl.classList.remove('visible');
    this.awaitingLevelUpChoice = false;
    this.levelUpOverlayEl.classList.add('hidden');
    this.awaitingSharkWarning = false;
    this.sharkWarningOverlayEl.classList.add('hidden');
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.awaitingMilestone = false;
    this.pendingMilestone = false;
    this.milestoneOverlayEl?.classList.add('hidden');
    this.awaitingContinue = false;
    this.continueUsedThisRun = false;
    this.continueOverlayEl?.classList.add('hidden');
    this.gameOverOverlayEl?.classList.add('hidden');
    this.startBtn.classList.remove('hidden');
    this.paused = false;
    this.pauseOverlayEl.classList.add('hidden');
    this.loadBackground(getLevelBackground(config.level, this.mode)).catch((err) => console.warn('Background load failed:', err));
    this.updateStats();
    this.draw();
    if (!silent) this.checkForNewSharks(config);
    this.announceLevel();
    this.applyLevelMusic();
    this.updateDolphinsSavedBadge();
    this.updatePearlsBadge();
    return true;
  }

  /**
   * The zone-liberation payout for the level just cleared, or 0. Derived from currentLevel rather
   * than stored, so the banner and the award cannot disagree about the figure.
   */
  private zoneClearBonus(): number {
    const cleared = this.mode === 'endless' ? zoneClearedAt(this.currentLevel) : null;
    return cleared ? pearlsForZoneClear(zoneNumber(cleared)) : 0;
  }

  private announceLevel(duration = 2200): void {
    this.updateLevelBadge();

    // Depthless only: the first level of a depth zone announces the zone instead of the number,
    // which the HUD badge is already showing anyway. The campaign is one zone from end to end,
    // so a card on level 1 there would announce nothing the player is about to leave.
    const zone = this.mode === 'endless' ? zoneEnteredAt(this.currentLevel) : null;
    if (zone) {
      this.showBanner(`Entered the ${zone.name} Zone
${zone.depth}`, 'levelup', duration + 1400);
      this.setStatus(`${zone.name} Zone - ${zone.depth}`);
      return;
    }
    this.showBanner(`Level ${this.currentLevel}`, 'victory', duration);
  }

  private updateLevelBadge(): void {
    if (this.levelBadgeNumberEl) this.levelBadgeNumberEl.textContent = String(this.currentLevel);
  }

  /** Shown only in Campaign mode, where Dolphins Saved is actually tracked (see saveDolphinsAndDepart). */
  private updateDolphinsSavedBadge(): void {
    this.dolphinsSavedBadgeEl?.classList.toggle('hidden', this.mode !== 'campaign');
    if (this.dolphinsSavedNumberEl) this.dolphinsSavedNumberEl.textContent = String(this.totalDolphinsSaved);
  }

  /** The persisted Pearl balance, shown in both modes (see src/pearls.ts). */
  private updatePearlsBadge(): void {
    if (this.pearlsNumberEl) this.pearlsNumberEl.textContent = String(getPearls());
  }

  /** Banks `n` Pearls: adds to the persisted balance and the run total, and refreshes the HUD. */
  private awardRunPearls(n: number): void {
    if (n <= 0) return;
    this.pearlsThisRun += n;
    awardPearls(n);
    this.updatePearlsBadge();
  }

  /**
   * Picks the background music track for the level just entered (a no-op on a same-level retry,
   * since currentLevel won't have changed). A boss level gets a fresh random boss track; the level
   * right after a boss level (or level 1 of a fresh run) gets a fresh random ambient track; any other
   * level leaves whatever's already playing alone, so the ambient track loops across a whole block.
   */
  private applyLevelMusic(): void {
    if (this.currentLevel === this.lastMusicLevel) return;
    this.lastMusicLevel = this.currentLevel;

    const config = getLevelConfig(this.currentLevel);
    if (config.matriarch) {
      this.onMusicTrackChange?.(pickRandomTrack(BOSS_TRACKS));
      return;
    }

    const previousWasBoss = this.currentLevel > 1 && getLevelConfig(this.currentLevel - 1).matriarch;
    if (this.currentLevel === 1 || previousWasBoss) {
      this.onMusicTrackChange?.(pickRandomTrack(AMBIENT_TRACKS));
    }
  }

  /**
   * Adds an entity sprite at the given draw layer. The sort is explicit because setting
   * sortableChildren and a zIndex is not enough on its own here - Pixi never re-sorted, and the
   * sprites stayed in insertion order, which is what put the sharks over the top of the pod.
   */
  /**
   * The Echolocation ping: a ring sweeping out to the full radius over the first fraction of a
   * second, then the boundary held at low opacity for as long as the ping lasts, so the player
   * can see exactly how far their vision currently reaches.
   */
  private drawEchoRing(now: number, scale: number): void {
    this.echoRing.clear();
    if (!this.player || !this.isEcholocating()) return;

    const SWEEP_MS = 550;
    const elapsed = now - this.echoStartedAt;
    const cx = this.player._x * scale + scale / 2;
    const cy = this.player._y * scale + scale / 2;
    const full = this.echoRadius * scale;

    // The held boundary, so the reach is always legible.
    this.echoRing.circle(cx, cy, full).stroke({ width: 1.5, color: 0x67e8f9, alpha: 0.22 });

    if (elapsed < SWEEP_MS) {
      const t = elapsed / SWEEP_MS;
      this.echoRing
        .circle(cx, cy, full * t)
        .stroke({ width: 3, color: 0x67e8f9, alpha: 0.75 * (1 - t) });
    }
  }

  /**
   * The two arcs around the player: Boost on the inside, Echolocation outside it.
   *
   * An arc that fills as the ability comes back, and a faint closed ring once it is ready, so the
   * state is readable at a glance without reading a number. Echolocation's arc is only drawn if
   * the ability is owned, so a player who has not bought it sees one ring rather than a dial that
   * never does anything.
   */
  private drawAbilityMeters(sprite: Container): void {
    const boostMeter = sprite.getChildByName('boostMeter') as Graphics | null;
    const echoMeter = sprite.getChildByName('echoMeter') as Graphics | null;

    const arc = (g: Graphics, radius: number, fraction: number, color: number) => {
      g.clear();
      if (fraction >= 1) {
        g.circle(0, 0, radius).stroke({ width: 1.5, color, alpha: 0.5 });
        return;
      }
      // Starts at twelve o'clock and fills clockwise, the way any dial does.
      const start = -Math.PI / 2;
      g.arc(0, 0, radius, start, start + Math.PI * 2 * Math.max(0, fraction));
      g.stroke({ width: 2.5, color, alpha: 0.85 });
    };

    if (boostMeter) arc(boostMeter, BOOST_METER_RADIUS, this.getSprintCooldownFraction(), 0xfacc15);
    if (echoMeter) {
      if (this.hasEcholocation()) arc(echoMeter, ECHO_METER_RADIUS, this.getEchoCooldownFraction(), 0x67e8f9);
      else echoMeter.clear();
    }
  }

  private addEntitySprite(container: Container, zIndex: number): void {
    this.entityContainer.addChild(container);
    container.zIndex = zIndex;
    this.entityContainer.sortChildren();
  }

  private addDolphinSprite(dolphin: Dolphin): void {
    const container = new Container();

    const glow = new Sprite(this.glowTexture);
    glow.anchor.set(0.5);
    glow.width = 28;
    glow.height = 28;
    glow.alpha = 0.5;
    glow.name = 'glow';
    container.addChild(glow);

    const ring = new Graphics();
    ring.circle(0, 0, 14).stroke({ width: 2, color: 0xfacc15, alpha: 0 });
    ring.name = 'boostRing';
    container.addChild(ring);

    const invulRing = new Graphics();
    invulRing.circle(0, 0, 14).stroke({ width: 2, color: 0xa855f7, alpha: 0 });
    invulRing.name = 'invulRing';
    container.addChild(invulRing);

    // The two ability meters. Drawn on the dolphin rather than in a corner because that is where
    // the player is already looking, and because the abilities are now fired by tapping the water
    // rather than by finding a button - there is no button left to put a dial on.
    const boostMeter = new Graphics();
    boostMeter.name = 'boostMeter';
    container.addChild(boostMeter);
    const echoMeter = new Graphics();
    echoMeter.name = 'echoMeter';
    container.addChild(echoMeter);

    const fish = createDolphinSprite(skinById(equippedSkinId()).palette);
    fish.name = 'fish';
    container.addChild(fish);

    this.addEntitySprite(container, dolphin.isPlayer ? Z_PLAYER : Z_DOLPHIN);
    this.dolphinSprites.set(dolphin, container);
  }

  private removeDolphinSprite(dolphin: Dolphin): void {
    const sprite = this.dolphinSprites.get(dolphin);
    if (sprite) {
      this.entityContainer.removeChild(sprite);
      sprite.destroy();
      this.dolphinSprites.delete(dolphin);
    }
  }

  /** Detaches a dolphin's sprite from normal tracking and animates it swimming off-screen before destroying it. */
  private departDolphinSprite(dolphin: Dolphin): void {
    const sprite = this.dolphinSprites.get(dolphin);
    if (!sprite) return;
    this.dolphinSprites.delete(dolphin);

    const startX = sprite.x;
    const start = performance.now();
    const DURATION = 650;
    const DRIFT = 220;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      sprite.x = startX + t * DRIFT;
      sprite.alpha = 1 - t;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityContainer.removeChild(sprite);
        sprite.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Drops a shark's lights. They are parented to lightsContainer rather than to the sprite, so
   * destroying the sprite does not take them with it - without this they would hang in the water
   * where the shark died.
   */
  private disposeSharkLights(sprite: Container): void {
    for (const group of [this.sharkLights, this.sharkEyes]) {
      const lights = group.get(sprite);
      if (!lights) continue;
      this.lightsContainer.removeChild(lights);
      lights.destroy({ children: true });
      group.delete(sprite);
    }
  }

  private removeSharkSprite(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    if (sprite) {
      this.disposeSharkLights(sprite);
      this.entityContainer.removeChild(sprite);
      sprite.destroy();
      this.sharkSprites.delete(shark);
    }
  }

  /** A more dramatic death for large sharks and the Matriarch - rapid tint flashing plus a
   * scale-and-fade burst, instead of the instant removal small sharks get. */
  private playSharkDeathAnimation(shark: Shark): void {
    const sprite = this.sharkSprites.get(shark);
    if (!sprite) return;
    this.disposeSharkLights(sprite);
    this.sharkSprites.delete(shark);
    // A cloaked tiger killed mid-cloak still gets its send-off: the draw loop no longer owns
    // this sprite, so nothing would turn it back on.
    sprite.visible = true;

    const fish = sprite.getChildByName('fish') as unknown as { tint: number } | null;
    const baseScaleX = sprite.scale.x;
    const baseScaleY = sprite.scale.y;
    const start = performance.now();
    const DURATION = 700;
    const FLASH_INTERVAL = 70;
    let lastFlash = 0;
    let flashOn = false;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION);

      if (fish && elapsed - lastFlash >= FLASH_INTERVAL) {
        lastFlash = elapsed;
        flashOn = !flashOn;
        fish.tint = flashOn ? 0xffffff : 0xff2222;
      }

      const burst = 1 + Math.sin(t * Math.PI) * 0.4;
      sprite.scale.set(baseScaleX * burst, baseScaleY * burst);
      sprite.alpha = 1 - t;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityContainer.removeChild(sprite);
        sprite.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  /** Endless mode: instead of being destroyed, the Matriarch flashes damaged and swims off - she'll be back. */
  private fleeMatriarch(shark: Shark): void {
    // The Matriarch first appears at level 10, then every 10 levels; seeing her off at 20+
    // means the player has now survived a second encounter.
    if (this.currentLevel >= 20) this.tryUnlock('matriarchRematch');
    const sprite = this.sharkSprites.get(shark);
    if (sprite) {
      this.disposeSharkLights(sprite);
      this.sharkSprites.delete(shark);
      const fish = sprite.getChildByName('fish');
      if (fish) (fish as unknown as { tint: number }).tint = 0xff4444;

      const startX = sprite.x;
      const start = performance.now();
      const DURATION = 900;
      const DRIFT = 260;
      const animate = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        sprite.x = startX + t * DRIFT;
        sprite.alpha = 1 - t;
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          this.entityContainer.removeChild(sprite);
          sprite.destroy();
        }
      };
      requestAnimationFrame(animate);
    }
    this.setStatus('The Matriarch flees, wounded...');
    this.showBanner('Matriarch Flees!', 'storm', 2600);
  }

  private addSharkSprite(shark: Shark): void {
    const container = new Container();
    const look = SHARK_KIND_LOOK[shark.kind];

    const glowTex = makeRadialGradientTexture(64, look.glow);
    const glow = new Sprite(glowTex);
    glow.anchor.set(0.5);
    glow.width = 48;
    glow.height = 48;
    glow.alpha = 0.5;
    glow.name = 'glow';
    container.addChild(glow);

    const textureSet =
      this.sharkTextureSets[SHARK_SPRITE_SOURCE[shark.kind]] ??
      this.sharkTextureSets.greatWhite ??
      this.sharkTextureSets.hammerhead ??
      this.sharkTextureSets.tiger;

    if (textureSet) {
      try {
        const fish = createSharkSprite(textureSet, look.animationSpeed);
        fish.name = 'fish';
        fish.tint = look.tint;
        fish.scale.set(SHARK_BASE_SCALE);
        container.addChild(fish);
      } catch (err) {
        console.warn('Failed to create shark sprite, using fallback:', err);
        container.addChild(this.createFallbackSharkFish());
      }
    } else {
      console.warn('No shark textures available yet, using fallback shark sprite.');
      container.addChild(this.createFallbackSharkFish());
    }

    if (shark.kind === 'cookiecutter') {
      const lockTell = new Graphics();
      lockTell.name = 'lockTell';
      lockTell.visible = false;
      container.addChild(lockTell);
    }

    if (look.eyes) {
      const eyes = createEyes(look.eyes, look.eyeColor ?? 0x4ade80);
      eyes.name = 'eyes';
      this.lightsContainer.addChild(eyes);
      this.sharkEyes.set(container, eyes);
    }

    if (look.photophores) {
      const lights = createPhotophores(look.photophores, look.photophoreColor ?? 0x4ade80);
      lights.name = 'photo';
      // Parented to the lights layer, not to the shark, so the gloom cannot cover it. It is
      // positioned from the shark each frame in drawSharks, and removed with it in removeShark.
      this.lightsContainer.addChild(lights);
      this.sharkLights.set(container, lights);
    }

    const reqText = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: '#ffffff',
        align: 'center',
        fontWeight: 'bold',
      },
    });
    reqText.anchor.set(0.5);
    reqText.name = 'reqText';
    container.addChild(reqText);

    this.addEntitySprite(container, Z_SHARK);
    this.sharkSprites.set(shark, container);
  }

  private createFallbackSharkFish(): Container {
    const fish = new Container();
    fish.name = 'fish';
    const body = new Graphics();
    body.ellipse(0, 0, 17, 7.5).fill({ color: 0x64748b });
    body.moveTo(13, -3).lineTo(21, 0).lineTo(13, 3).closePath().fill({ color: 0x64748b });
    fish.addChild(body);
    return fish;
  }

  /**
   * Swims a pod member toward its formation slot the way the player moves: a continuous
   * heading rather than 8-direction snapping, eased into a turn, and slowed on approach.
   *
   * The old version stepped `Math.sign(delta) * speed` on each axis, so a follower always
   * moved a full step in one of 8 directions - it overshot its slot, reversed on the next
   * tick, and flip-flopped its facing, which read as shaky and clunky next to the player's
   * analog movement.
   */
  private moveTowards(dolphin: Dolphin, tx: number, ty: number, speed: number): void {
    const dx = directionDelta(tx, dolphin._x);
    const dy = ty - dolphin._y;
    const dist = Math.hypot(dx, dy);

    // Velocity the slot is asking for: full speed far out, easing to zero on arrival. There is
    // deliberately no "close enough, stop" threshold - against a slot that is itself moving, a
    // cutoff makes a follower flick between moving and frozen every few ticks, which is exactly
    // what read as shaking.
    // CATCH_UP lets a follower briefly outpace the player to close a gap. Capped at the
    // player's own speed it could never recover the ground lost while easing through a turn,
    // so the pod slowly strung out behind instead of holding formation.
    const SLOW_RADIUS = 3;
    const CATCH_UP = 1.5;
    // Inside PARK_RADIUS ask for nothing, so a follower stops micro-correcting on the spot.
    // Safe now that the formation only turns with the player: a moving slot outruns this in a
    // single tick, so it can never park mid-chase (which is what the old 0.4 radius did).
    const PARK_RADIUS = 0.15;
    const wanted = dist < PARK_RADIUS ? 0 : Math.min(speed * CATCH_UP, (dist / SLOW_RADIUS) * speed);
    const desiredVX = dist > 0.001 ? (dx / dist) * wanted : 0;
    const desiredVY = dist > 0.001 ? (dy / dist) * wanted : 0;

    // Ease the actual velocity toward it rather than adopting it outright: turns arc, and a
    // follower coasts to a halt in its slot instead of stopping dead. Responsiveness pulls harder
    // on that easing, which is what makes a sharp corner read as a corner rather than an arc.
    const SMOOTH = POD_BASE_SMOOTH + this.podResponsiveness * POD_SMOOTH_PER_LEVEL;
    dolphin.velX += (desiredVX - dolphin.velX) * SMOOTH;
    dolphin.velY += (desiredVY - dolphin.velY) * SMOOTH;

    // Below a twentieth of a world unit per tick there is nothing left to show; park it so a
    // settled pod is completely still.
    if (Math.hypot(dolphin.velX, dolphin.velY) < 0.05) {
      dolphin.velX = 0;
      dolphin.velY = 0;
      return;
    }
    dolphin._x = wrapX(dolphin._x + dolphin.velX);
    dolphin._y = clampEntityY(dolphin._y + dolphin.velY, 2);
  }

  private moveFollowers(): void {
    if (!this.player) return;
    // Followers read the same bonus, or the pod is left behind the moment a shrimp is spent.
    const followerSpeed = 2 * (1 + this.speedBonusPct + this.shrimpSpeedBonus) * (this.sprinting ? SPRINT_SPEED : 1);
    const followers = this.dolphins.filter((d) => d.recruited && !d.isPlayer);
    // A single fixed-radius ring packs dolphins on top of each other once the pod gets big (the
    // Mega Pod especially). A golden-angle spiral instead spreads them across a disk whose area
    // grows with the pod, so density - and spacing - stays roughly constant at any pod size.
    const GOLDEN_ANGLE = 2.39996;
    const MAX_RADIUS = 35;

    // The formation is oriented by the player's heading, not by a clock. It used to spin with
    // `gameTime * 0.5`, so every slot orbited the player forever - the pod could never settle
    // and kept shuffling even while the player stood still. Now it holds station and only
    // sweeps round as the player actually turns.
    const pdx = directionDelta(this.player._x, this.player.lastX);
    const pdy = this.player._y - this.player.lastY;
    if (Math.hypot(pdx, pdy) > 0.05) {
      let diff = Math.atan2(pdy, pdx) - this.podHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.podHeading += diff * (POD_BASE_TURN_RATE + this.podResponsiveness * POD_TURN_PER_LEVEL);
    }

    followers.forEach((dolphin, idx) => {
      const angle = idx * GOLDEN_ANGLE + this.podHeading;
      // Responsiveness draws the whole spiral in, so the pod occupies less water at any size.
      const tighten = Math.max(0.5, 1 - this.podResponsiveness * POD_TIGHTEN_PER_LEVEL);
      const radius = Math.min(MAX_RADIUS, (4 + 2 * Math.sqrt(idx)) * tighten);
      // Not rounded: quantising the slot to whole units made it hop between cells, which the
      // follower then chased - another source of the twitchy look.
      const tx = wrapX(this.player!._x + Math.cos(angle) * radius);
      const ty = clampEntityY(this.player!._y + Math.sin(angle) * radius, 2);
      this.moveTowards(dolphin, tx, ty, followerSpeed);
    });
  }

  private gameOver(): void {
    this.running = false;
    this.totalLost++;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
    this.setStatus('Eaten by a shark');
    this.showBanner('Game Over', 'gameover');
    // The game-over sting is a five-second phrase rather than an impact, so the level music
    // stops outright rather than ducking under it: a loop carrying on underneath sounds muddy,
    // and a loop swelling back up afterwards undercuts the ending entirely. It starts again
    // from the top when a run does - see onMusicResume.
    sfx.playGameOver();
    this.onMusicStop?.();

    // Android only: one Continue per Endless run - watch a rewarded ad or buy it (src/ads.ts, src/iap.ts).
    if (this.mode === 'endless' && isAndroid && !this.continueUsedThisRun && (ads.available || iap.available)) {
      this.showContinueOffer();
      return;
    }
    this.finishGameOver();
  }

  /**
   * The wall at level 30: the run ends here, and not as a death.
   *
   * A descent that reaches the floor of the Bathypelagic without Iron Skin has done everything
   * right and simply cannot go on - the water below would crush a dolphin that has not been
   * hardened to it. So it is banked the way a finished run is, with the depth it reached and the
   * Pearls it earned, and the player is told what opens the way rather than being told they lost.
   * No death is counted: nothing killed them.
   */
  private turnBackAtTheCrush(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.flushLifetimeStats();
    this.setStatus('The pressure turns you back - Iron Skin opens the water below');
    this.showBanner('Turned Back by the Pressure', 'storm', 3600);
    sfx.playAchievement();
    this.onMusicStop?.();
    this.pendingScore = {
      board: 'endless',
      score: {
        levelReached: this.currentLevel,
        timeSurvived: this.runElapsed,
        recruited: this.totalRecruited,
        sharksKilled: this.sharksKilled,
      },
    };
    this.showRunSummary('endless');
  }

  /** The end of a run once Continue is declined / unavailable / already used. */
  private finishGameOver(): void {
    if (isAndroid) {
      // No free retry on Android - the run is over (or you took the Continue offer).
      this.startBtn.classList.add('hidden');
    } else {
      // "Dive Again", not "Retry": in the Depthless Campaign the button starts a new descent
      // rather than handing the level back, and the label has to say which it is doing.
      this.startBtn.textContent = this.mode === 'endless' ? 'Dive Again' : 'Retry';
    }

    if (this.mode === 'endless') {
      this.endlessDeaths++;
      const timeSurvived = this.runElapsed;
      this.pendingScore = {
        board: 'endless',
        score: {
          levelReached: this.currentLevel,
          timeSurvived,
          recruited: this.totalRecruited,
          sharksKilled: this.sharksKilled,
        },
      };
      this.showRunSummary('endless');
    } else if (isAndroid) {
      // Campaign keeps its checkpoint (Continue Campaign from the title); with no Retry
      // button the player still needs an explicit way back to the menu.
      this.gameOverOverlayEl?.classList.remove('hidden');
    }
  }

  /** Android Endless Game Over: offer a one-time Continue (rewarded ad or IAP). */
  private showContinueOffer(): void {
    if (!this.continueOverlayEl) {
      this.finishGameOver();
      return;
    }
    this.awaitingContinue = true;
    if (this.continueDepthEl) this.continueDepthEl.textContent = `Level ${this.currentLevel}`;

    if (this.continueAdBtnEl) {
      this.continueAdBtnEl.classList.toggle('hidden', !ads.available);
      this.continueAdBtnEl.disabled = !ads.rewardedReady;
      if (ads.available && !ads.rewardedReady) {
        void ads.preloadRewarded().then((ready) => {
          if (this.continueAdBtnEl && this.awaitingContinue) this.continueAdBtnEl.disabled = !ready;
        });
      }
    }
    if (this.continuePayBtnEl) {
      this.continuePayBtnEl.classList.add('hidden');
      void iap.continuePrice().then((price) => {
        if (this.continuePayBtnEl && this.awaitingContinue && price) {
          this.continuePayBtnEl.textContent = `Continue – ${price}`;
          this.continuePayBtnEl.classList.remove('hidden');
        }
      });
    }

    this.continueOverlayEl.classList.remove('hidden');
  }

  async continueViaAd(): Promise<void> {
    if (this.continueAdBtnEl) this.continueAdBtnEl.disabled = true;
    const rewarded = await ads.showRewarded();
    if (rewarded) this.revive();
    else if (this.continueAdBtnEl) this.continueAdBtnEl.disabled = !ads.rewardedReady;
  }

  async continueViaPurchase(): Promise<void> {
    if (this.continuePayBtnEl) this.continuePayBtnEl.disabled = true;
    const purchased = await iap.buyContinue();
    if (purchased) this.revive();
    else if (this.continuePayBtnEl) this.continuePayBtnEl.disabled = false;
  }

  /** "No Thanks" on the Continue offer - proceed to the normal run-summary. */
  declineContinue(): void {
    if (!this.awaitingContinue) return;
    this.awaitingContinue = false;
    this.continueOverlayEl?.classList.add('hidden');
    this.finishGameOver();
  }

  /** Puts the player back in the water mid-run with a fresh pod. Score / sharks / level all carry over. */
  private revive(): void {
    if (!this.player) {
      this.declineContinue();
      return;
    }
    this.continueUsedThisRun = true;
    this.awaitingContinue = false;
    this.continueOverlayEl?.classList.add('hidden');
    // Taking the Continue goes straight back into the same run, so the music has to come back.
    this.onMusicResume?.();

    this.player.invulnerableUntil = Date.now() + 4000;
    this.player._x = Math.floor(SIZE_X / 2);
    this.player._y = Math.floor(SIZE_Y / 2);
    for (let i = 0; i < 3; i++) this.spawnRecruitedDolphin(this.player._x, this.player._y);

    this.playerHitCooldownUntil = Date.now() + 4000;
    this.resetKillCombo();
    this.running = true;
    this.setStatus('Back in the water!');
    this.showBanner('Continue!', 'victory', 1500);
    this.lastFrameTime = 0;
    this.step();
  }

  private levelComplete(): void {
    this.levelCompleted = true;
    // Clearing the level it appeared on is the only thing that spends the run's encounter. The
    // level cannot be cleared with it alive, so reaching here means it was beaten.
    // Beating it is what spends the run's encounter; the optional finisher is extra.
    if (this.megamouthEncounterScheduled && this.megamouthAppearedThisLevel) this.megamouthDone = true;
    this.resetKillCombo();
    if (this.lostThisLevel === 0) this.tryUnlock('flawlessLevel');
    if (this.mode === 'campaign' && this.currentLevel === 5) this.tryUnlock('halfwayThere');
    if (this.wasOnLastLifeThisLevel) this.tryUnlock('comeback');
    this.flushLifetimeStats();
    // Banked against the profile rather than the run: it is what gates Iron Skin, and a depth
    // survived once has been survived. Endless only - the campaign's ten are a different ladder.
    if (this.mode === 'endless') markLevelCleared(this.currentLevel);
    const pearls = pearlsForLevel(this.currentLevel, this.lostThisLevel === 0);
    this.awardRunPearls(pearls);
    // Liberating a depth zone pays a milestone bonus on top of the level's own Pearls. Banked
    // here rather than on the card that announces it, so it is already in the balance by the
    // time the player reads the number.
    this.awardRunPearls(this.zoneClearBonus());
    if (this.mode === 'endless' && this.currentLevel === 50) this.pendingMilestone = true;
    this.saveDolphinsAndDepart();
    this.setStatus('All sharks destroyed!');
    sfx.playLevelComplete();
    this.onMusicDuck?.(2400);

    // The campaign finale gets a longer pause and skips the generic banner - it's reached right
    // after the Matriarch's own "Matriarch Defeated!" banner, which this would otherwise stomp.
    const isCampaignFinale = this.mode === 'campaign' && this.currentLevel === LEVELS.length;
    if (!isCampaignFinale) {
      this.showBanner(`Level Complete!  +${pearls} Pearls`, 'victory', 1800);
    }

    if (this.levelCompleteTimer) clearTimeout(this.levelCompleteTimer);
    this.levelCompleteTimer = setTimeout(() => {
      this.levelCompleteTimer = null;
      if (isCampaignFinale) {
        this.recordCampaignClear();
      } else if (this.pendingMilestone) {
        this.pendingMilestone = false;
        this.showMilestone();
      } else {
        this.showLevelUpChoice();
      }
    }, isCampaignFinale ? 5000 : 2000);
  }

  /** Fires the instant the level is cleared, not when the next one starts: in Campaign mode, the
   * outgoing pod's size is banked as Dolphins Saved and the companions swim off-screen right away.
   * Endless mode just clears them instantly (no saved-dolphins tracking there - see Mega Pod docs). */
  private saveDolphinsAndDepart(): void {
    if (!this.player) return;
    if (this.mode === 'campaign') {
      const pod = this.getPodSize();
      this.totalDolphinsSaved += pod;
      this.updateDolphinsSavedBadge();
      const lifetime = bumpLifetime('dolphinsSaved', pod);
      if (lifetime >= 1000) this.tryUnlock('guardianOfThePod');
      else if (lifetime >= 100) this.tryUnlock('homebound');
    }
    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer) {
        if (this.mode === 'campaign') this.departDolphinSprite(dolphin);
        else this.removeDolphinSprite(dolphin);
      }
    }
    this.dolphins = [this.player];
  }

  /** Campaign-mode classic ending: clearing level 10 stops the run and prompts for the leaderboard. */
  private recordCampaignClear(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    clearRunCheckpoint();
    const timeToSaveOcean = this.runElapsed;
    this.pendingScore = {
      board: 'campaign',
      score: {
        timeToSaveOcean,
        retries: this.retries,
        recruited: this.totalRecruited,
        lost: this.totalLost,
        sharksKilled: this.sharksKilled,
      },
    };

    this.flushLifetimeStats();
    if (timeToSaveOcean <= 720) this.tryUnlock('speedrunner');
    if (this.retries === 0) this.tryUnlock('noDoOvers');
    if (this.totalLost === 0) this.tryUnlock('flawlessCampaign');

    this.awardRunPearls(PEARLS_CAMPAIGN_CLEAR + (this.totalLost === 0 ? PEARLS_FLAWLESS_CAMPAIGN_BONUS : 0));

    // Unlocks Echolocation for purchase in the Store (src/store.ts reads this).
    markCampaignCleared();

    // The banner and the status line are read together as one sentence - "Sharks Vanquished,
    // the Shallows are now safe.." - because the banner is a single nowrap line and the whole
    // phrase would run off the canvas. Shallows rather than Ocean: clearing the campaign secures
    // the top ten levels, and the Depthless Campaign below is the rest of the water.
    this.setStatus('The Shallows are now safe..');
    this.startBtn.textContent = 'Retry';
    this.showBanner('Sharks Vanquished', 'victory');
    this.showRunSummary('campaign');
  }

  /** End-of-run card: the dolphin's name, a stat grid, and any achievements from this run. */
  private showRunSummary(board: LeaderboardBoard): void {
    if (!this.runSummaryOverlayEl || !this.pendingScore) return;
    this.awaitingRunSummary = true;

    if (this.runSummaryTitleEl) this.runSummaryTitleEl.textContent = board === 'campaign' ? 'Sharks Vanquished' : 'Run Over';
    if (this.runSummaryNameEl) this.runSummaryNameEl.textContent = getDolphinName();

    this.renderRunSummaryStats();
    this.renderDoublePearlsOffer(board);

    if (this.runSummaryAchievementsEl) {
      const unlocked = [...new Set(this.achievementsThisRun)]
        .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
        .filter((a): a is (typeof ACHIEVEMENTS)[number] => !!a);
      this.runSummaryAchievementsEl.innerHTML = unlocked
        .map((a) => `<div class="row"><span>${a.icon}</span><span>${a.name}</span></div>`)
        .join('');
    }

    // A run bought its way into never reaches the board, and the card has to say so rather than
    // offering a Save that silently does nothing.
    const ranked = this.runIsRanked();
    if (this.runSummarySaveBtnEl) {
      this.runSummarySaveBtnEl.classList.toggle('hidden', !ranked);
      this.runSummarySaveBtnEl.disabled = !ranked;
    }
    if (this.runSummaryUnrankedEl) {
      this.runSummaryUnrankedEl.classList.toggle('hidden', ranked);
      if (!ranked) {
        this.runSummaryUnrankedEl.textContent =
          `Started at level ${this.depthlessStartLevel}, so this dive is not eligible for the leaderboard. Dive from level 1 to post a score.`;
      }
    }

    // The Share button (and its Orca-skin reward) is a campaign-clear thing only.
    if (this.runSummaryShareBtnEl) {
      this.runSummaryShareBtnEl.classList.toggle('hidden', board !== 'campaign');
      this.runSummaryShareBtnEl.textContent = 'Share';
      this.runSummaryShareBtnEl.disabled = false;
    }
    // On Android there is no Retry button after Game Over - offer an explicit way back to the menu.
    this.runSummaryHomeBtnEl?.classList.toggle('hidden', !isAndroid);

    this.runSummaryOverlayEl.classList.remove('hidden');
  }

  /**
   * Paints the stat grid. Split out of showRunSummary because doubling the Pearls has to redraw
   * it - the earned and balance rows are the whole point of the offer, and leaving them showing
   * the pre-ad numbers would read as the reward not having landed.
   */
  private renderRunSummaryStats(): void {
    if (!this.runSummaryStatsEl || !this.pendingScore) return;
    const rows: [string, string][] =
      this.pendingScore.board === 'campaign'
        ? [
            ['Time', `${this.pendingScore.score.timeToSaveOcean.toFixed(1)}s`],
            ['Retries', String(this.pendingScore.score.retries)],
            ['Dolphins recruited', String(this.pendingScore.score.recruited)],
            ['Dolphins lost', String(this.pendingScore.score.lost)],
            ['Dolphins saved', String(this.totalDolphinsSaved)],
            ['Sharks destroyed', String(this.pendingScore.score.sharksKilled)],
            ['Pearls earned', String(this.pearlsThisRun)],
            ['Pearl balance', String(getPearls())],
          ]
        : [
            ['Depth', `Level ${this.pendingScore.score.levelReached}`],
            ['Survived', `${this.pendingScore.score.timeSurvived.toFixed(1)}s`],
            ['Dolphins recruited', String(this.pendingScore.score.recruited)],
            ['Sharks destroyed', String(this.pendingScore.score.sharksKilled)],
            ['Pearls earned', String(this.pearlsThisRun)],
            ['Pearl balance', String(getPearls())],
          ];
    this.runSummaryStatsEl.innerHTML = rows
      .map(([label, value]) => `<span class="label">${label}</span><span class="value">${value}</span>`)
      .join('');
  }

  /**
   * The one rewarded-ad offer in the campaign: double the Pearls just earned, opt-in, with the
   * exact number on the button before the ad plays. It only appears on a campaign clear, which
   * is the run's high point and the only moment the player is looking at a Pearl total they are
   * pleased with - and it is never the way forward, since the Pearls are already banked and
   * ignoring it costs nothing.
   */
  private renderDoublePearlsOffer(board: LeaderboardBoard): void {
    const btn = this.runSummaryDoubleBtnEl;
    if (!btn) return;

    const offerable = board === 'campaign' && ads.available && this.pearlsThisRun > 0 && !this.pearlsDoubledThisRun;
    btn.classList.toggle('hidden', !offerable);
    if (!offerable) return;

    const token = ++this.doubleOfferToken;
    btn.textContent = `▶ Watch an ad to double your ${this.pearlsThisRun} Pearls`;
    btn.disabled = !ads.rewardedReady;
    if (!ads.rewardedReady) {
      // Same as the Continue offer: show it straight away and enable it when the fill arrives,
      // rather than hiding an offer that is about to become available.
      void ads.preloadRewarded().then((ready) => {
        if (token !== this.doubleOfferToken) return;
        if (this.runSummaryDoubleBtnEl && this.awaitingRunSummary && !this.pearlsDoubledThisRun) {
          this.runSummaryDoubleBtnEl.disabled = !ready;
        }
      });
    }
  }

  /** Run-summary "double your Pearls" button: pays out only if the ad reports the reward earned. */
  async doublePearlsViaAd(): Promise<void> {
    const btn = this.runSummaryDoubleBtnEl;
    if (!btn || this.pearlsDoubledThisRun || this.pearlsThisRun <= 0) return;
    btn.disabled = true;

    const rewarded = await ads.showRewarded();
    if (!rewarded) {
      // Cancelled, or no fill. Nothing is taken away - the offer simply stays on the table.
      btn.disabled = !ads.rewardedReady;
      return;
    }

    // Captured first: awardRunPearls adds to pearlsThisRun, so reading it afterwards would
    // double the doubled figure.
    const bonus = this.pearlsThisRun;
    this.pearlsDoubledThisRun = true;
    this.awardRunPearls(bonus);
    this.renderRunSummaryStats();

    btn.textContent = `Pearls doubled ✓  +${bonus}`;
    btn.disabled = true;
    sfx.playAchievement();
    this.setStatus(`+${bonus} Pearls!`);
  }

  /** Campaign-clear Share button: opens the share sheet and, on success, grants the reward skin once. */
  async shareCampaign(): Promise<void> {
    if (this.runSummaryShareBtnEl) this.runSummaryShareBtnEl.disabled = true;
    const shared = await shareMilestone('campaign', getDolphinName());
    if (shared) {
      this.claimShareReward();
      if (this.runSummaryShareBtnEl) this.runSummaryShareBtnEl.textContent = 'Shared ✓';
    } else if (this.runSummaryShareBtnEl) {
      this.runSummaryShareBtnEl.disabled = false;
    }
  }

  /** Endless "Level 50!" milestone overlay - pauses the run until the player shares or taps Keep Diving. */
  private showMilestone(): void {
    this.awaitingMilestone = true;
    if (this.milestoneTextEl) {
      this.milestoneTextEl.textContent = `${getDolphinName()} dove deeper than almost anyone. Share the dive?`;
    }
    this.renderShareReward();
    this.milestoneOverlayEl?.classList.remove('hidden');
  }

  async shareEndless50(): Promise<void> {
    const shared = await shareMilestone('endless50', getDolphinName());
    if (shared) this.claimShareReward();
    this.renderShareReward();
  }

  /** "Keep Diving": closes the milestone overlay and continues to the normal level-up choice. */
  dismissMilestone(): void {
    if (!this.awaitingMilestone) return;
    this.awaitingMilestone = false;
    this.milestoneOverlayEl?.classList.add('hidden');
    this.showLevelUpChoice();
  }

  /** Grants the share-reward skin the first time a milestone is shared. Idempotent. */
  private claimShareReward(): void {
    if (grantSkin(SHARE_REWARD_SKIN)) {
      // Named from the catalogue rather than written out, so changing which skin the share
      // unlocks is a one-line edit in share.ts instead of a hunt through the copy.
      const name = skinById(SHARE_REWARD_SKIN).name;
      this.setStatus(`${name} skin unlocked!`);
      this.showBanner(`${name} Skin Unlocked!`, 'statup', 2600);
    }
  }

  /** Paints the reward preview + caption into #milestoneReward (also used to refresh after a share). */
  private renderShareReward(): void {
    if (!this.milestoneRewardEl) return;
    const owned = ownsSkin(SHARE_REWARD_SKIN);
    const skin = skinById(SHARE_REWARD_SKIN);
    this.milestoneRewardEl.innerHTML = '';

    const preview = document.createElement('canvas');
    preview.className = 'store-skin-preview';
    preview.width = 132;
    preview.height = 88;
    const pctx = preview.getContext('2d');
    if (pctx) {
      const body = makeDolphinBodyCanvas(skin.palette);
      pctx.drawImage(body, 0, 0, body.width, body.height, 0, 0, preview.width, preview.height);
    }
    this.milestoneRewardEl.appendChild(preview);

    const caption = document.createElement('div');
    caption.className = 'milestone-reward-caption';
    caption.textContent = owned ? `${skin.name} skin unlocked ✓` : `Share to unlock the ${skin.name} skin`;
    this.milestoneRewardEl.appendChild(caption);
  }

  /** Every 3rd Endless death on Android, show a preloaded interstitial at this natural break. */
  private maybeInterstitial(board: LeaderboardBoard): void {
    if (isAndroid && board === 'endless' && this.endlessDeaths > 0 && this.endlessDeaths % 3 === 0) {
      void ads.maybeShowInterstitial();
    }
  }

  /** Saves the pending score to the local + Play Games leaderboards under the dolphin's name. */
  submitPendingScore(): void {
    if (!this.pendingScore) return;
    // Belt and braces: the button is hidden for an unranked run, but the submission refuses on
    // its own so nothing reaching this method by another route can post a bought score.
    if (!this.runIsRanked()) {
      this.dismissRunSummary();
      return;
    }
    const name = getDolphinName();
    if (this.pendingScore.board === 'campaign') {
      saveCampaignScore({ ...this.pendingScore.score, name });
      // Time board is milliseconds, smaller-is-better (see src/playGames.ts).
      void playGames.submit('campaign', this.pendingScore.score.timeToSaveOcean * 1000);
    } else {
      saveEndlessScore({ ...this.pendingScore.score, name });
      void playGames.submit('endless', this.pendingScore.score.levelReached);
    }
    const board = this.pendingScore.board;
    this.pendingScore = null;
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.maybeInterstitial(board);
    this.showLeaderboard(board);
  }

  /** Dismisses the run-summary card without saving the score. */
  dismissRunSummary(): void {
    const board = this.pendingScore?.board ?? this.currentLeaderboardBoard;
    this.pendingScore = null;
    this.awaitingRunSummary = false;
    this.runSummaryOverlayEl?.classList.add('hidden');
    this.maybeInterstitial(board);
  }

  showLeaderboard(board: LeaderboardBoard = this.currentLeaderboardBoard): void {
    if (!this.leaderboardListEl || !this.leaderboardHeadEl) return;
    this.currentLeaderboardBoard = board;
    this.leaderboardTabCampaignBtn?.classList.toggle('active', board === 'campaign');
    this.leaderboardTabEndlessBtn?.classList.toggle('active', board === 'endless');
    this.leaderboardListEl.innerHTML = '';

    if (board === 'campaign') {
      if (this.leaderboardHeadingEl) this.leaderboardHeadingEl.textContent = 'Campaign Leaderboard';
      this.leaderboardHeadEl.innerHTML =
        '<tr><th>#</th><th>Name</th><th>Time</th><th>Retries</th><th>Recruited</th><th>Lost</th><th>Sharks</th></tr>';
      const scores = loadCampaignScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(7, 'No completed campaign runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td class="name-cell" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td><td>${s.timeToSaveOcean.toFixed(1)}s</td><td>${s.retries}</td><td>${s.recruited}</td><td>${s.lost}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    } else {
      if (this.leaderboardHeadingEl) this.leaderboardHeadingEl.textContent = 'Depthless Leaderboard';
      this.leaderboardHeadEl.innerHTML = '<tr><th>#</th><th>Name</th><th>Level</th><th>Survived</th><th>Recruited</th><th>Sharks</th></tr>';
      const scores = loadEndlessScores();
      if (scores.length === 0) {
        this.renderEmptyLeaderboardRow(6, 'No endless runs yet.');
      } else {
        for (const [i, s] of scores.entries()) {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i + 1}</td><td class="name-cell" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td><td>${s.levelReached}</td><td>${s.timeSurvived.toFixed(1)}s</td><td>${s.recruited}</td><td>${s.sharksKilled}</td>`;
          this.leaderboardListEl.appendChild(row);
        }
      }
    }

    void this.updateGlobalLeaderboardSection(board);
    this.leaderboardOverlayEl?.classList.remove('hidden');
  }

  /**
   * Play Games Services global rank for the current board (Android only). Off Android
   * `playGames.available` is false and the whole section stays hidden, leaving the local
   * table as the only leaderboard - which is also all the web/PWA build ever has.
   */
  private async updateGlobalLeaderboardSection(board: LeaderboardBoard): Promise<void> {
    const section = this.leaderboardGlobalEl;
    if (!section) return;
    if (!playGames.available) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    if (this.leaderboardGlobalBtn) this.leaderboardGlobalBtn.hidden = true;
    if (this.leaderboardSignInBtn) this.leaderboardSignInBtn.hidden = true;
    if (this.leaderboardGlobalRankEl) this.leaderboardGlobalRankEl.textContent = 'Checking Play Games…';

    const signedIn = await playGames.ensureSignedIn();
    if (this.currentLeaderboardBoard !== board) return; // a later showLeaderboard() switched boards

    if (!signedIn) {
      if (this.leaderboardGlobalRankEl) {
        this.leaderboardGlobalRankEl.textContent = 'Sign in to Play Games for a global rank.';
      }
      if (this.leaderboardSignInBtn) this.leaderboardSignInBtn.hidden = false;
      return;
    }

    const score = await playGames.playerScore(board);
    if (this.currentLeaderboardBoard !== board) return;
    if (this.leaderboardGlobalBtn) this.leaderboardGlobalBtn.hidden = false;
    if (this.leaderboardGlobalRankEl) {
      this.leaderboardGlobalRankEl.textContent =
        score && score.hasScore
          ? `Global rank ${score.displayRank ?? '#' + score.rank}  ·  ${score.displayScore ?? ''}`.trim()
          : 'No global score yet — finish a run to get on the board.';
    }
  }

  private renderEmptyLeaderboardRow(colSpan: number, text: string): void {
    if (!this.leaderboardListEl) return;
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = colSpan;
    cell.textContent = text;
    row.appendChild(cell);
    this.leaderboardListEl.appendChild(row);
  }

  hideLeaderboard(): void {
    this.leaderboardOverlayEl?.classList.add('hidden');
    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  /**
   * The between-levels beat. In the Campaign this is the Mega Shrimp pick; in the Depthless
   * Campaign there is nothing to pick, because a Depthless dolphin only grows in the Store, so
   * it announces the level and sends the player east without stopping them.
   *
   * Both paths still have to do the same two jobs the overlay used to do on its way past: put up
   * the banner - including the zone liberation, which is the run's milestone - and arm the swim
   * east prompt, or the run simply stops at the end of a level.
   */
  private showLevelUpChoice(): void {
    // Clearing the last level of a depth zone is the run's milestone beat - it replaces the
    // generic "Level Up!" rather than being queued behind it, since both would land on the same
    // banner within a second of each other.
    const cleared = this.mode === 'endless' ? zoneClearedAt(this.currentLevel) : null;
    const bonus = this.zoneClearBonus();
    // "Level Up!" belongs to the Campaign's Mega Shrimp pick. In the Depthless Campaign nothing
    // levels up between levels, so an ordinary clear gets no second banner at all - the level's
    // own "Level Complete" and the swim-east prompt already say everything there is to say.
    const bannerText = cleared
      ? `Sharks Vanquished
${cleared.name} Zone Liberated
+${bonus} Pearls`
      : this.mode === 'endless'
        ? ''
        : 'Level Up!';
    if (bannerText) this.showBanner(bannerText, 'levelup', cleared ? 3400 : 2600);
    if (cleared) {
      this.setStatus(`${cleared.name} Zone liberated! +${bonus} Pearls`);
      sfx.playAchievement();
    }

    // Depthless: no pick, so head straight for the next level rather than opening the overlay.
    // Nothing to restart here - unlike the Campaign's overlay, this path never halted the loop,
    // which is still ticking and will carry the player east on its own.
    if (this.mode === 'endless') {
      // Unless the water below will not have them. A descent stops at the floor of the
      // Bathypelagic without Iron Skin, however well it was going.
      if (this.currentLevel >= IRON_SKIN_UNLOCK_LEVEL && !this.ironSkin) {
        this.turnBackAtTheCrush();
        return;
      }
      if (!cleared) this.setStatus(`Swim east to reach Level ${this.currentLevel + 1}`);
      this.awaitingNewWaters = true;
      this.newWatersPromptEl.classList.add('visible');
      return;
    }

    this.awaitingLevelUpChoice = true;
    if (this.megaShrimpHintEl) {
      const firstTime = !hasSeenHint('megaShrimp');
      this.megaShrimpHintEl.classList.toggle('hidden', !firstTime);
      if (firstTime) markHintSeen('megaShrimp');
    }
    this.levelUpOverlayEl.classList.remove('hidden');
  }

  chooseUpgrade(kind: 'vitality' | 'speed' | 'charisma' | 'boost'): void {
    if (!this.awaitingLevelUpChoice) return;
    this.awaitingLevelUpChoice = false;
    this.levelUpOverlayEl.classList.add('hidden');

    let statName = '';
    switch (kind) {
      case 'vitality':
        this.vitalityLives += 1;
        statName = 'Vitality';
        break;
      case 'speed':
        this.speedBonusPct += 0.1;
        statName = 'Speed';
        break;
      case 'charisma':
        this.charismaBonusDolphins += 1;
        statName = 'Charisma';
        break;
      case 'boost':
        this.sprintCooldownReduction += 1500;
        statName = 'Boost';
        break;
    }

    this.showBanner(`${statName} Increased!`, 'statup', 2200);
    this.setStatus(`Swim east to reach Level ${this.currentLevel + 1}`);
    this.awaitingNewWaters = true;
    this.newWatersPromptEl.classList.add('visible');

    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  private async advanceLevel(): Promise<void> {
    this.awaitingNewWaters = false;
    this.newWatersPromptEl.classList.remove('visible');
    this.currentLevel += 1;
    this.wasOnLastLifeThisLevel = false;
    if (this.mode === 'endless') {
      if (this.currentLevel >= 15) this.tryUnlock('deepDiver');
      if (this.currentLevel >= 25) this.tryUnlock('abyssal');
      if (this.currentLevel >= 40) this.tryUnlock('intoTheTrench');
    }
    const config = getLevelConfigForMode(this.currentLevel, this.mode);

    this.setStatus(`Level ${this.currentLevel}: hunt the sharks!`);
    this.announceLevel(2500);
    this.applyLevelMusic();
    this.updateDolphinsSavedBadge();

    if (this.player) {
      // Companions already departed (Campaign) or were removed (Endless) back in levelComplete(),
      // right when the level actually finished - this just clears any stragglers defensively and
      // rebuilds the pod for the level being entered.
      for (const dolphin of this.dolphins) {
        if (!dolphin.isPlayer) this.removeDolphinSprite(dolphin);
      }
      this.dolphins = [this.player];

      for (let i = 0; i < this.charismaBonusDolphins; i++) {
        this.spawnRecruitedDolphin(this.player._x, this.player._y);
      }

      this.player.invulnerableUntil = Date.now() + LEVEL_START_INVULNERABILITY_MS;
      this.pendingLevelInvulnerability = true;
      this.autoFormedForThisPod = false;
      // Shrimp last the level, not the run. Nothing cleared this before, so a single boost
      // silently carried through every remaining level of a campaign.
      this.shrimpSpeedBonus = 0;
      this.ghostUntil = 0;
      this.player.speedBoostUntil = 0;
    }

    this.levelCompleted = false;
    this.lostThisLevel = 0;
    this.spawnSharksForLevel(config);
    this.checkForNewSharks(config);
    if (this.mode === 'campaign') this.saveCheckpoint();

    await this.loadBackground(getLevelBackground(this.currentLevel, this.mode));
  }

  private checkForNewSharks(config: LevelConfig): void {
    const warnings: { name: string; description: string }[] = [];

    for (const k of config.sharkKinds) {
      if (!this.seenSharkKinds.has(k) && SHARK_INTRO_INFO[k]) {
        warnings.push(SHARK_INTRO_INFO[k]!);
      }
      this.seenSharkKinds.add(k);
    }

    if (config.largeSharkCount > 0 && !this.seenLargeSharkVariety) {
      warnings.push({
        name: 'Larger Shark Varieties',
        description:
          "These waters hold larger, stronger sharks. A big pod alone won't finish one - you have to Boost (Space, or the ⚡ button) into it while your pod meets its number. Upgrade Boost between levels to dash more often.",
      });
      this.seenLargeSharkVariety = true;
    }

    if (config.largeSharkCount > 0) {
      for (const k of config.sharkKinds) {
        if (!this.seenLargeSharkKinds.has(k) && LARGE_SHARK_INTRO_INFO[k]) {
          warnings.push(LARGE_SHARK_INTRO_INFO[k]!);
          this.seenLargeSharkKinds.add(k);
        }
      }
    }

    if (warnings.length > 0) {
      this.showSharkWarning(warnings);
    }
  }

  private showSharkWarning(warnings: { name: string; description: string }[]): void {
    this.awaitingSharkWarning = true;
    this.sharkWarningListEl.innerHTML = '';
    for (const info of warnings) {
      const item = document.createElement('div');
      item.className = 'shark-warning-item';
      const name = document.createElement('strong');
      name.textContent = info.name;
      const desc = document.createElement('p');
      desc.textContent = info.description;
      item.appendChild(name);
      item.appendChild(desc);
      this.sharkWarningListEl.appendChild(item);
    }
    this.sharkWarningOverlayEl.classList.remove('hidden');
  }

  dismissSharkWarning(): void {
    if (!this.awaitingSharkWarning) return;
    this.awaitingSharkWarning = false;
    this.sharkWarningOverlayEl.classList.add('hidden');
    if (this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  /** Queues a one-time explanatory tooltip the first time a system (Form Pod, Hunting Mode) triggers. */
  private queueTutorialHint(id: HintId, heading: string, text: string): void {
    if (hasSeenHint(id)) return;
    markHintSeen(id);
    this.hintQueue.push({ heading, text });
    this.tryShowNextHint();
  }

  private tryShowNextHint(): void {
    if (this.awaitingTutorialHint || this.hintQueue.length === 0) return;
    if (!this.tutorialHintOverlayEl || !this.tutorialHintTextEl) return;
    const hint = this.hintQueue.shift()!;
    this.awaitingTutorialHint = true;
    if (this.tutorialHintHeadingEl) this.tutorialHintHeadingEl.textContent = hint.heading;
    this.tutorialHintTextEl.textContent = hint.text;
    this.tutorialHintOverlayEl.classList.remove('hidden');
  }

  dismissTutorialHint(): void {
    if (!this.awaitingTutorialHint) return;
    this.awaitingTutorialHint = false;
    this.tutorialHintOverlayEl?.classList.add('hidden');
    this.tryShowNextHint();
    if (!this.awaitingTutorialHint && this.running && !this.paused) {
      this.lastFrameTime = 0;
      this.step();
    }
  }

  /** Unlocks an achievement if it isn't already, queueing its toast if this is a new unlock. Non-blocking. */
  private tryUnlock(id: AchievementId): void {
    const def = unlock(id);
    if (!def) return;
    this.achievementQueue.push({ icon: def.icon, name: def.name });
    this.achievementsThisRun.push(def.id);
    this.processAchievementQueue();
  }

  /** Shows queued achievement toasts one at a time - a single event (a campaign clear especially)
   * can unlock several at once, and the old single-toast code just overwrote them. */
  private processAchievementQueue(): void {
    if (this.achievementToastTimeout || this.achievementQueue.length === 0) return;
    if (!this.achievementToastEl || !this.achievementToastNameEl) {
      this.achievementQueue = [];
      return;
    }
    const next = this.achievementQueue.shift()!;
    sfx.playAchievement();
    if (this.achievementToastIconEl) this.achievementToastIconEl.textContent = next.icon;
    this.achievementToastNameEl.textContent = next.name;
    this.achievementToastEl.classList.add('visible');
    this.achievementToastTimeout = setTimeout(() => {
      this.achievementToastEl?.classList.remove('visible');
      this.achievementToastTimeout = setTimeout(() => {
        this.achievementToastTimeout = null;
        this.processAchievementQueue();
      }, 350);
    }, 2600);
  }

  /** Pushes this run's new shark kills and elapsed play time into the persistent lifetime
   * totals and unlocks the cumulative achievements. Called at run-end points and periodically
   * from step(); safe to call repeatedly (it only ever adds the un-synced delta). */
  private flushLifetimeStats(): void {
    const newKills = this.sharksKilled - this.syncedSharkKills;
    if (newKills > 0) {
      this.syncedSharkKills = this.sharksKilled;
      const total = bumpLifetime('sharksKilled', newKills);
      if (total >= 1000) this.tryUnlock('sharkaggeddon');
      else if (total >= 100) this.tryUnlock('sharkCentury');
    }
    const wholeSeconds = Math.floor(this.unsyncedPlaySeconds);
    if (wholeSeconds > 0) {
      this.unsyncedPlaySeconds -= wholeSeconds;
      const total = bumpLifetime('playSeconds', wholeSeconds);
      if (total >= 36000) this.tryUnlock('theLongGame');
    }
  }

  showAchievements(): void {
    if (!this.achievementsListEl) return;
    const unlocked = getUnlockedMap();
    this.achievementsListEl.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const date = unlocked[a.id];
      const row = document.createElement('div');
      row.className = `achievement-row${date ? ' unlocked' : ''}`;
      row.innerHTML = `
        <span class="achievement-icon">${date ? a.icon : '🔒'}</span>
        <div class="achievement-copy">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.description}</div>
        </div>
        <span class="achievement-status">${date ? new Date(date).toLocaleDateString() : 'Locked'}</span>
      `;
      this.achievementsListEl.appendChild(row);
    }
    this.achievementsOverlayEl?.classList.remove('hidden');
  }

  hideAchievements(): void {
    this.achievementsOverlayEl?.classList.add('hidden');
  }

  private getPodSize(): number {
    return this.dolphins.filter((d) => d.isPlayer || d.recruited).length;
  }

  /** Radius at which a shark can bite the pod. Deliberately tight - see sharkRamRadius. */
  /**
   * How long a shark is drawn, in world units - the same product the draw loop scales the sprite
   * by, over WORLD_SCALE. The frilled shark's strike reaches one of these.
   */
  private sharkBodyLength(shark: Shark): number {
    const look = SHARK_KIND_LOOK[shark.kind];
    const frame = 64 * SHARK_BASE_SCALE * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
    return (frame * look.stretchX) / WORLD_SCALE;
  }

  /** Pod members a shark is allowed to take: the player and anyone recruited. */
  private podMembers(): Dolphin[] {
    return this.dolphins.filter((d) => d.isPlayer || d.recruited);
  }

  /**
   * Which pod member a hazard takes: a follower if any follower is in reach, and the player only
   * when nobody else is.
   *
   * The pod is the health bar - every dolphin is a life, and the player is the last of them. A
   * shark's bite has always worked this way, searching the pod for someone who is not the player
   * and only falling through to the extra-life branch when it finds nobody. The kraken, the
   * megamouth and the jellyfish did not: each took the first pod member it found in reach, and
   * since the player is always the first entry in `dolphins`, an arm that touched the player took
   * the player - ending a run on the spot with a full pod of followers swimming alongside
   * untouched. That is the bug this exists to close, and it is worth having in one place so the
   * next hazard cannot get it wrong on its own.
   */
  private pickHazardVictim(inReach: (d: Dolphin) => boolean): Dolphin | undefined {
    const pod = this.podMembers();
    return pod.find((d) => !d.isPlayer && inReach(d)) ?? pod.find((d) => d.isPlayer && inReach(d));
  }

  /**
   * The large cookiecutter's lock-on run.
   *
   * Every LOCK_INTERVAL_MS it singles out one pod member, announces it, and a moment later runs
   * at where that dolphin was when the warning ended. The aim is taken once: a run that tracked
   * its target would be unavoidable, and the player is meant to be able to boost the pod off the
   * line. Reaching the target is handled by the ordinary bite check, which knows to take the
   * locked dolphin rather than whichever one happens to be last in the list.
   */
  private updateLockOnStrikes(now: number): void {
    if (!this.player) return;
    // Not while there are still small sharks in the water. A lock-on asks the player to move the
    // whole pod off one line at one moment, and that is not something they can give while they
    // are also being worried at from every other direction - level 14 fields six smalls beside
    // its large, and the run that is meant to be a set piece arrives as one more thing at once.
    // A strike already in flight still lands; only the next one waits. This is the rule the large
    // tiger's cloak already runs on, for the same reason - see canCloak.
    const smallSharksLeft = this.sharks.some((s) => !s.large);
    for (const shark of this.sharks) {
      if (shark.kind !== 'cookiecutter' || !shark.large) continue;

      // A target that has already been eaten, or left the pod, ends the strike wherever it is.
      if (shark.lockTarget && !this.dolphins.includes(shark.lockTarget)) {
        shark.lockTarget = null;
        shark.lockPhase = 'none';
        shark.lockCooldownEnd = now + LOCK_INTERVAL_MS;
        continue;
      }

      if (shark.lockPhase === 'warning') {
        if (now < shark.lockPhaseEndTime) continue;
        // Aim now, at where it is now, and commit.
        const target = shark.lockTarget;
        if (!target) {
          shark.lockPhase = 'none';
          shark.lockCooldownEnd = now + LOCK_INTERVAL_MS;
          continue;
        }
        const dx = directionDelta(target._x, shark._x);
        const dy = target._y - shark._y;
        const d = Math.hypot(dx, dy) || 1;
        shark.lockDx = dx / d;
        shark.lockDy = dy / d;
        shark.lockPhase = 'zoom';
        shark.lockPhaseEndTime = now + LOCK_ZOOM_MS;
        sfx.playLockOnStrike();
        continue;
      }

      if (shark.lockPhase === 'zoom') {
        if (now < shark.lockPhaseEndTime) continue;
        shark.lockPhase = 'none';
        shark.lockTarget = null;
        shark.lockCooldownEnd = now + LOCK_INTERVAL_MS;
        continue;
      }

      // Idle: pick someone, if it is off cooldown and can see the pod at all.
      if (shark.lockCooldownEnd === 0) {
        shark.lockCooldownEnd = now + LOCK_FIRST_DELAY_MS;
        continue;
      }
      if (now < shark.lockCooldownEnd) continue;
      if (smallSharksLeft) continue;
      if (this.levelGloom > 0 && shark.cloaked) continue;
      const candidates = this.podMembers().filter(
        (d) => this.distanceBetweenEntities(shark, d) <= LOCK_RANGE && now >= d.invulnerableUntil,
      );
      if (candidates.length === 0) continue;
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      shark.lockTarget = target;
      shark.lockPhase = 'warning';
      shark.lockPhaseEndTime = now + LOCK_WARNING_MS;
      sfx.playLockOnWarning();
      this.showBanner(target.isPlayer ? 'Cookiecutter locked on you!' : 'Cookiecutter locked on!', 'storm', LOCK_WARNING_MS);
      this.setStatus('A cookiecutter has picked out a dolphin');
    }
  }

  /** Drives a locked shark forward itself, in place of its ordinary pursuit. */
  private moveLockedShark(shark: Shark, sharkSpeed: number): void {
    // lastX/lastY are left alone: the step loop rolls them over at the end of every tick, which
    // is what the swept bite check reads, and move() does not touch them either.
    const step = sharkSpeed * shark.speedMultiplier * LOCK_ZOOM_SPEED;
    shark._x = wrapX(shark._x + shark.lockDx * step);
    shark._y = clampEntityY(shark._y + shark.lockDy * step, 4);
    shark.headingX = shark.lockDx;
    shark.headingY = shark.lockDy;
  }

  /**
   * The large frilled shark's head extension.
   *
   * Fires when a pod member comes inside range: the head goes out over REACH_EXTEND_MS, holds,
   * and comes back, and then the shark is spent for REACH_COOLDOWN_MS. Nothing about the body
   * moves - the reach is all in the strike, which is what lets something this slow still be
   * dangerous to a dolphin that has outswum it, and the recharge is what lets that dolphin get
   * away with being close once the strike has been spent.
   */
  private updateFrilledReach(now: number): void {
    for (const shark of this.sharks) {
      if (shark.kind !== 'frilled' || !shark.large) continue;

      if (shark.reachPhase === 'out') {
        const left = shark.reachPhaseEndTime - now;
        shark.reach = Math.max(0, Math.min(1, 1 - left / REACH_EXTEND_MS));
        if (now >= shark.reachPhaseEndTime) {
          shark.reach = 1;
          shark.reachPhase = 'hold';
          shark.reachPhaseEndTime = now + REACH_HOLD_MS;
        }
        continue;
      }
      if (shark.reachPhase === 'hold') {
        if (now >= shark.reachPhaseEndTime) {
          shark.reachPhase = 'back';
          shark.reachPhaseEndTime = now + REACH_RETRACT_MS;
        }
        continue;
      }
      if (shark.reachPhase === 'back') {
        const left = shark.reachPhaseEndTime - now;
        shark.reach = Math.max(0, Math.min(1, left / REACH_RETRACT_MS));
        if (now >= shark.reachPhaseEndTime) {
          shark.reach = 0;
          shark.reachPhase = 'none';
          shark.reachCooldownEnd = now + REACH_COOLDOWN_MS;
        }
        continue;
      }

      shark.reach = 0;
      if (now < shark.reachCooldownEnd) continue;
      const range = this.sharkBodyLength(shark) * FRILLED_REACH_FRACTION;
      const inRange = this.podMembers().some((d) => this.distanceBetweenEntities(shark, d) <= range);
      if (!inRange) continue;
      // Aimed at whoever brought it on, once, and never corrected - see Shark.reachDirX. Taking
      // the swimming heading instead threw the head along the flanking arc, which is why the
      // strike drew and sounded correctly while landing nowhere near the pod.
      const target = this.podMembers().reduce((closest, d) =>
        this.distanceBetweenEntities(shark, d) < this.distanceBetweenEntities(shark, closest) ? d : closest,
      );
      const aimX = directionDelta(target._x, shark._x);
      const aimY = target._y - shark._y;
      const aim = Math.hypot(aimX, aimY) || 1;
      shark.reachDirX = aimX / aim;
      shark.reachDirY = aimY / aim;
      shark.reachPhase = 'out';
      shark.reachPhaseEndTime = now + REACH_EXTEND_MS;
      sfx.playFrilledStrike();
    }
  }

  /**
   * How brightly a shark's eye is showing: nothing beyond SHARK_EYE_RANGE, full inside the last
   * SHARK_EYE_FADE units, and eased between. Measured to the nearest pod member rather than to
   * the player, so an eye that has fixed on a follower is lit too.
   */
  private sharkEyeAlpha(shark: Shark): number {
    const pod = this.podMembers();
    if (pod.length === 0) return 0;
    const near = Math.min(...pod.map((d) => this.distanceBetweenEntities(shark, d)));
    if (near >= SHARK_EYE_RANGE) return 0;
    if (near <= SHARK_EYE_RANGE - SHARK_EYE_FADE) return 1;
    return (SHARK_EYE_RANGE - near) / SHARK_EYE_FADE;
  }

  /** Wrap-aware distance between any two things in the water. */
  private distanceBetweenEntities(a: { _x: number; _y: number }, b: { _x: number; _y: number }): number {
    return Math.hypot(directionDelta(a._x, b._x), a._y - b._y);
  }

  /**
   * Where a shark's jaws actually are. Ordinarily its own position; for a frilled shark mid-strike,
   * out along its heading by however far the head has been thrown.
   */
  private sharkBitePoint(shark: Shark): { _x: number; _y: number; lastX: number; lastY: number } {
    if (shark.reach <= 0) return shark;
    const out = this.sharkBodyLength(shark) * FRILLED_REACH_FRACTION * shark.reach;
    // Along the committed strike direction, not the swimming heading.
    const dirX = shark.reachDirX || shark.headingX;
    const dirY = shark.reachDirY || shark.headingY;
    // The whole of the thrown head bites, not only its tip. Testing the tip alone meant a strike
    // aimed correctly at something closer than full extension sailed straight past it - the head
    // was drawn lying across a dolphin while the one point that counted was five units beyond it.
    // The nearest pod member is projected onto the reach and the jaws taken there instead.
    let along = out;
    const pod = this.podMembers();
    if (pod.length > 0) {
      const near = pod.reduce((closest, d) =>
        this.distanceBetweenEntities(shark, d) < this.distanceBetweenEntities(shark, closest) ? d : closest,
      );
      const relX = directionDelta(near._x, shark._x);
      const relY = near._y - shark._y;
      along = Math.max(0, Math.min(out, relX * dirX + relY * dirY));
    }
    return {
      _x: shark._x + dirX * along,
      _y: shark._y + dirY * along,
      lastX: shark.lastX + dirX * along,
      lastY: shark.lastY + dirY * along,
    };
  }

  private sharkHitRadius(shark: Shark): number {
    if (shark.matriarch) return 10;
    const base = shark.kind === 'greatWhite' && shark.large ? 6 : 4;
    // Every shark used to bite from the same 4-unit hitbox regardless of how big it was drawn -
    // a hammerhead renders at twice a tiger's scale, a large tiger at 3x - so their jaws
    // visibly closed over a dolphin with nothing happening. Scaled to the sprite like
    // sharkRamRadius, though more conservatively: this is the radius that hurts the player.
    const drawScale = SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
    return Math.max(base, 3 * Math.sqrt(drawScale));
  }

  /**
   * Whether a shark made contact with the pod during this tick, swept rather than sampled at the
   * tick boundary so a fast pass-through still registers.
   *
   * Contact with *any* pod member counts, not just the dolphin you are steering. The bite used
   * to test the steered dolphin alone while the jaws-open animation fired on any dolphin within
   * six units, so sharks - hammerheads worst of all, they are drawn at twice a tiger's scale on
   * the same 4-unit hitbox - visibly chewed on your followers with nothing happening.
   */
  private sharkContactsPod(shark: Shark): boolean {
    if (!this.player) return false;
    // A shark that has cleared out for the kraken is not in the water as far as anything else is
    // concerned - it can neither bite nor be rammed until it has swum back.
    if (shark.isOffStage()) return false;
    const radius = this.sharkHitRadius(shark);
    const jaws = this.sharkBitePoint(shark);
    return this.dolphins.some((d) => (d.isPlayer || d.recruited) && sweptDistance(jaws, d) < radius);
  }

  /**
   * How close a dolphin has to be for a shark to open its jaws. Kept just outside the reach that
   * actually bites, so the animation is anticipation rather than a lie.
   */
  private sharkAttackTell(shark: Shark): number {
    return this.sharkHitRadius(shark) + SHARK_ATTACK_ANTICIPATION;
  }

  /**
   * Radius at which the pod can destroy a shark. Scaled to the drawn sprite
   * (SHARK_KIND_SCALE x sizeMultiplier - see the draw loop), because a large tiger is 3x
   * the size of a small one but used to share its 4-unit hitbox: you could sprint visibly
   * *through* one and have the ram not register. Kept separate from (and never smaller than)
   * the bite radius, so generous player hitboxes don't also make sharks more dangerous.
   */
  private sharkRamRadius(shark: Shark): number {
    const bite = this.sharkHitRadius(shark);
    if (shark.matriarch) return bite;
    const drawScale = SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
    return Math.max(bite, 4 * Math.sqrt(drawScale));
  }

  /** Large tigers only cloak once every small shark is dead - see CLOAK_DURATION_MS. */
  private canCloak(shark: Shark): boolean {
    return shark.kind === 'tiger' && shark.large && !shark.matriarch;
  }

  /**
   * Runs the large-tiger cloak cycle. A cloaked tiger is drawn nowhere but keeps hunting
   * normally, so the only warning you get is the puff of water it leaves behind as it goes.
   */
  private updateCloaks(now: number): void {
    const smallSharksLeft = this.sharks.some((s) => !s.large);
    for (const shark of this.sharks) {
      if (!this.canCloak(shark)) continue;
      if (shark.cloaked) {
        if (now >= shark.cloakEndTime) this.revealShark(shark, now);
      } else if (!smallSharksLeft && now >= shark.cloakCooldownEnd) {
        shark.cloaked = true;
        shark.cloakEndTime = now + CLOAK_DURATION_MS;
        this.emitCloakBurst(shark);
        this.setStatus('A tiger shark vanishes...');
        this.showBanner('It Vanished!', 'storm', 1500);
      }
    }
  }

  /** Drops the cloak and starts the recharge - on timeout, or the moment it takes a dolphin. */
  private revealShark(shark: Shark, now: number): void {
    if (!shark.cloaked) return;
    shark.cloaked = false;
    shark.cloakCooldownEnd = now + CLOAK_COOLDOWN_MS;
    this.emitCloakBurst(shark);
  }

  private emitCloakBurst(shark: Shark): void {
    const scale = WORLD_SCALE;
    this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 12, {
      speed: 1.8,
      life: 0.7,
    });
  }

  /** Shark opacity for the level-opening safety window: faded, then eased back to full. */
  private sharkAlphaWhileSafe(now: number): number {
    const remaining = this.levelStartSafeUntil - now;
    if (remaining <= 0) return 1;
    if (remaining >= SHARK_FADE_RESTORE_MS) return SHARK_FADE_WHILE_SAFE;
    const t = 1 - remaining / SHARK_FADE_RESTORE_MS;
    return SHARK_FADE_WHILE_SAFE + (1 - SHARK_FADE_WHILE_SAFE) * t;
  }

  /** Thin wrapper over the shared rule, which the Sharkopedia prints from - see sharks.ts. */
  private sharkPodRequirement(kind: SharkKind, large: boolean): number {
    return podRequirement(kind, large, this.currentLevel);
  }

  /**
   * How much a large shallow-water shark is slowed for being down in the Mesopelagic.
   *
   * The species that belong down there carry photophores, so however dark it gets you can track
   * one by its lights. A great white or a hammerhead carries none, which is the whole of the
   * problem: at 0.62 gloom they arrive out of nothing, and at their size they arrive fast. Taking
   * a sixth off gives back the half-second it takes to read what has just appeared and turn the
   * pod, without making either of them slow - a large great white still runs ahead of everything
   * else in the water.
   *
   * Only the large ones, and only in this zone. A small hammerhead is not what anyone loses a pod
   * to, and the shallows are lit well enough that seeing one coming was never the issue.
   */
  private mesopelagicLargeSpeedFactor(kind: SharkKind, level: number): number {
    if (!isMesopelagicLevel(level)) return 1;
    return kind === 'greatWhite' || kind === 'hammerhead' ? MESO_LARGE_SPEED_FACTOR : 1;
  }

  private randomizeSharkSpawnPosition(shark: Shark): void {
    if (!this.player) return;
    let tries = 0;
    do {
      shark._x = Math.floor(Math.random() * SIZE_X);
      shark._y = Math.floor(Math.random() * SIZE_Y);
      tries += 1;
    } while (this.distanceToPlayer(shark) < SHARK_SPAWN_CLEARANCE && tries < 40);
    shark.lastX = shark._x;
    shark.lastY = shark._y;
  }

  /**
   * Distance from a shark to the player, measured the way the world actually works. Comparing raw
   * x values ignores the horizontal wrap entirely: a shark at x=98 with the player at x=2 measures
   * as 96 units clear when it is really 4. That used to let sharks spawn on top of the pod, and it
   * would just as happily hide one standing next to you in the dark.
   */
  private distanceToPlayer(shark: Shark): number {
    if (!this.player) return Infinity;
    return Math.hypot(directionDelta(shark._x, this.player._x), shark._y - this.player._y);
  }

  private spawnSharksForLevel(config: LevelConfig): void {
    for (const shark of this.sharks) {
      this.removeSharkSprite(shark);
    }
    this.sharks = [];

    let id = 0;
    // Some levels deal their species in turn rather than drawing each kind at random: with only a
    // handful of sharks over a short pool, a random draw can easily put none of one kind in front
    // of you. That is the one thing a test bench must not do, and equally the one thing a level
    // introducing a species must not do - see dealKindsInTurn in levels.ts. Levels with a deep
    // enough pool still draw at random.
    const dealInTurn = config.dealKindsInTurn === true;
    const pickKind = (i: number) =>
      dealInTurn
        ? config.sharkKinds[i % config.sharkKinds.length]
        : config.sharkKinds[Math.floor(Math.random() * config.sharkKinds.length)];

    // What the small draw actually produced, which is not the same as what the pool allows - see
    // seenSmallSharkKinds. Settled before the large sharks are dealt, because it gates them.
    const smallsHere = new Set<SharkKind>();
    for (let i = 0; i < config.normalSharkCount; i++) {
      const shark = new Shark(id++);
      shark.kind = pickKind(i);
      smallsHere.add(shark.kind);
      recordSharkEncounter(shark.kind, false);
      shark.sizeMultiplier = SHARK_KIND_LOOK[shark.kind].smallSize;
      shark.speedMultiplier = config.sharkSpeedMultiplier * SHARK_KIND_LOOK[shark.kind].speed;
      this.randomizeSharkSpawnPosition(shark);
      shark._y = clampEntityY(shark._y, 4);
      this.sharks.push(shark);
      this.addSharkSprite(shark);
    }

    // Two rules shape the large sharks, and both are about the set rather than the individual:
    // nothing may arrive large that the player has not met small (largeKindPool), and at most one
    // large great white until GREAT_WHITE_PAIR_FROM_LEVEL (dealLargeSharkKinds).
    const largePool = largeKindPool(config.sharkKinds, config.level, this.seenSmallSharkKinds, smallsHere);
    const largeKinds = dealLargeSharkKinds(largePool, config.largeSharkCount, config.level, dealInTurn);
    for (let i = 0; i < config.largeSharkCount; i++) {
      const shark = new Shark(id++);
      shark.kind = largeKinds[i];
      shark.large = true;
      recordSharkEncounter(shark.kind, true);
      shark.sizeMultiplier = shark.kind === 'tiger' ? LARGE_TIGER_SIZE_MULTIPLIER : LARGE_SHARK_SIZE_MULTIPLIER;
      shark.speedMultiplier =
        config.sharkSpeedMultiplier *
        SHARK_KIND_LOOK[shark.kind].speed *
        (shark.kind === 'greatWhite' ? GREAT_WHITE_LARGE_SPEED_BONUS : 1) *
        this.mesopelagicLargeSpeedFactor(shark.kind, config.level);
      this.randomizeSharkSpawnPosition(shark);
      const margin = Math.ceil((24 * shark.sizeMultiplier) / WORLD_SCALE);
      shark._y = clampEntityY(shark._y, margin);
      this.sharks.push(shark);
      this.addSharkSprite(shark);
    }

    // Banked only now, so this level's own smalls could not have unlocked this level's larges.
    for (const kind of smallsHere) this.seenSmallSharkKinds.add(kind);

    this.levelGloom = Math.max(0, Math.min(1, config.gloom ?? 0));
    this.maxDolphins = config.maxDolphins;
    this.dolphinSpawnInterval = developerModeActive()
      ? DEV_DOLPHIN_SPAWN_INTERVAL
      : config.level === 10
        ? DOLPHIN_SPAWN_INTERVAL / 2
        : DOLPHIN_SPAWN_INTERVAL;

    this.matriarch = null;
    this.matriarchWarningShown = false;
    this.matriarchSmallCleared = false;
    this.matriarchEnraged = false;
    this.matriarchSpawnerTimer = 0;
    this.megaPodAvailable = false;
    this.megaPodActive = false;
    this.matriarchHitsTaken = 0;
    this.matriarchHitCooldownUntil = 0;
    this.megaPodBtnWrap?.classList.add('hidden');
    if (config.matriarch) {
      this.matriarchWarningTime = this.gameTime + 25;
      this.matriarchSpawnTime = this.gameTime + 30;
    } else {
      this.matriarchWarningTime = 0;
      this.matriarchSpawnTime = 0;
    }

    this.beginLevelSetPieces(config);

    if (this.huntingMode) this.onSchoolingChange?.(false);
    this.huntingMode = false;
    this.readyToSchool = false;
    this.schoolBtnWrap.classList.add('hidden');
    this.updateHuntingVisuals();
    this.updateSharkGuide(config);
  }

  private spawnMatriarch(): void {
    const shark = new Shark(this.sharks.length);
    shark.kind = 'greatWhite';
    shark.large = true;
    shark.matriarch = true;
    shark.sizeMultiplier = LARGE_SHARK_SIZE_MULTIPLIER * 2;
    shark.speedMultiplier = 0.5;
    shark._x = SIZE_X + 15;
    shark._y = Math.floor(Math.random() * (SIZE_Y - 8)) + 4;
    shark.lastX = shark._x;
    shark.lastY = shark._y;
    this.matriarch = shark;
    this.sharks.push(shark);
    this.addSharkSprite(shark);
    recordEncounter('matriarch');
    this.setStatus('Matriarch has arrived!');
    this.showBanner('Matriarch!', 'storm', 2500);
  }

  private spawnMatriarchShark(): void {
    const shark = new Shark(this.sharks.length);
    shark.kind = 'greatWhite';
    shark.large = true;
    shark.sizeMultiplier = LARGE_SHARK_SIZE_MULTIPLIER;
    shark.speedMultiplier = 1.25;
    shark._x = SIZE_X + 15;
    shark._y = Math.floor(Math.random() * (SIZE_Y - 8)) + 4;
    shark.lastX = shark._x;
    shark.lastY = shark._y;
    this.sharks.push(shark);
    this.addSharkSprite(shark);
    this.setStatus('The Matriarch calls a great white');
  }

  private updateSharkGuide(config: LevelConfig): void {
    this.sharkGuideList.innerHTML = config.sharkKinds
      .map((kind) => {
        const name = SHARK_INTRO_INFO[kind]?.name ?? kind[0].toUpperCase() + kind.slice(1);
        const small = `<li><span>${name} (small)</span><span>${this.sharkPodRequirement(kind, false)}</span></li>`;
        const large = config.largeSharkCount > 0 ? `<li><span>${name} (large)</span><span>${this.sharkPodRequirement(kind, true)}</span></li>` : '';
        return small + large;
      })
      .join('');
  }

  private clearJellyfish(): void {
    this.jellyfishContainer.removeChildren();
    this.jellyfishSprites.clear();
    this.jellyfish = [];
  }

  private clearMegamouth(): void {
    if (this.megamouthSprite) {
      this.entityContainer.removeChild(this.megamouthSprite);
      this.megamouthSprite.destroy({ children: true });
      this.megamouthSprite = null;
    }
    if (this.megamouthLights) {
      this.lightsContainer.removeChild(this.megamouthLights);
      this.megamouthLights.destroy({ children: true });
      this.megamouthLights = null;
    }
    this.megamouth = null;
    this.megamouthHitCooldownUntil = 0;
    this.megamouthBleedAt = 0;
    this.megamouthTurnedAnnounced = false;
  }

  /**
   * Sends one megamouth across the arena.
   *
   * Built from the great white's own strip - blacked out with a tint and drawn at twice a large
   * one's size - rather than from new artwork, which is the same trick the frilled shark and the
   * cookiecutter are made with. Its photophores go in the lights layer with every other shark's,
   * so in dark water it arrives as a row of lights on something enormous, which is exactly the
   * read the zone has spent ten levels teaching.
   *
   * It is deliberately not pushed into `sharks`: almost everything that reads that list - the
   * cloak cycle, the Matriarch's spawner, the kill loop - is about sharks hunting the pod, and
   * this is not that. The level-complete check reads it separately instead (see step()), because
   * unlike the storm or the swarm this one does not pass: once it has arrived it has to be
   * brought down before the water is clear.
   */
  private startMegamouth(): void {
    this.activeEvent = { type: 'megamouth', endsAt: this.gameTime + MEGAMOUTH_DURATION };
    this.clearMegamouth();
    this.megamouthHitCooldownUntil = 0;
    this.megamouthTurnedAnnounced = false;

    // One heading, held for the whole event: it enters off a side at a random height and simply
    // keeps going, wrapping round rather than leaving. Something this size crossing once and
    // vanishing read as a fly-past; circling makes it a thing that is in the water with you.
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -MEGAMOUTH_WRAP_MARGIN : SIZE_X + MEGAMOUTH_WRAP_MARGIN;
    const y = SIZE_Y * (0.25 + Math.random() * 0.5);
    this.megamouth = new Megamouth(x, y, fromLeft ? 1 : -1, 0, MEGAMOUTH_SPEED);

    const textureSet = this.sharkTextureSets.greatWhite;
    const container = new Container();
    if (textureSet) {
      const fish = createSharkSprite(textureSet);
      fish.name = 'fish';
      // Near-black rather than pure: a flat 0x000000 tint kills the strip's shading entirely and
      // leaves a silhouette with no body in it.
      fish.tint = 0x14161f;
      fish.scale.set(SHARK_BASE_SCALE * SHARK_KIND_SCALE.greatWhite * MEGAMOUTH_SIZE);
      container.addChild(fish);
    }
    this.entityContainer.addChild(container);
    this.megamouthSprite = container;

    this.megamouthLights = createPhotophores(MEGAMOUTH_PHOTOPHORES, 0x93c5fd);
    this.lightsContainer.addChild(this.megamouthLights);

    this.megamouthAppearedThisLevel = true;
    recordEncounter('megamouth');
    this.setStatus('Something vast is moving through the dark');
    sfx.playMegamouth();
  }

  /**
   * Ends the *event*, not the animal.
   *
   * The arrival is what the event window covers - the warning, the sound, the spacing that keeps
   * two of these from landing on top of each other. The megamouth itself outlives it and keeps
   * swimming, so the rest of the level's weather can carry on around something that is still
   * down there. Everything that drives it keys off `this.megamouth` rather than off the event
   * for exactly this reason.
   */
  private endMegamouth(): void {
    this.activeEvent = null;
    if (this.megamouth) this.setStatus('It is still circling out there');
  }

  /**
   * Two creatures in one.
   *
   * While there are sharks in the water it holds its heading and crosses, wrapping round: nothing
   * it does depends on where the pod is. Once they are gone it knows it is the last thing here,
   * and turns on the pod: three times the speed, holding a line, bouncing off all four walls, and
   * bending toward you whenever you are near enough to be worth turning for.
   *
   * Deliberately no wrap while it is defensive. A creature that leaves one side of the arena and
   * reappears on the other cannot be cornered, and being cornered is the whole of the fight -
   * bounded on four sides it is something a pod can work into a wall and line a Boost up against.
   */
  private updateMegamouth(now: number): void {
    const m = this.megamouth;
    if (!m) return;

    if (m.beaten) {
      this.sinkMegamouth(m, now);
      this.drawMegamouth(m, now);
      return;
    }

    if (!m.defensive && this.sharks.length === 0 && !this.levelCompleted) this.turnMegamouthDefensive();

    // One correction a tick, toward the pod, and only while the pod is close enough to be worth
    // turning for - far away it simply holds its line and crosses. The strength falls off with
    // distance, so a pod on the far side barely bends it and a pod under its nose is followed.
    if (m.defensive && this.player) {
      const near = this.podMembers().reduce(
        (closest, d) =>
          this.distanceBetweenEntities(m, d) < this.distanceBetweenEntities(m, closest) ? d : closest,
        this.player,
      );
      const gap = this.distanceBetweenEntities(m, near);
      if (gap < MEGAMOUTH_HOMING_RANGE) {
        const strength = MEGAMOUTH_HOMING_STRENGTH * (1 - gap / MEGAMOUTH_HOMING_RANGE);
        m.turnToward(near._x, near._y, strength);
      }
    }

    const speed = m.speed * (m.defensive ? MEGAMOUTH_DEFENSIVE_SPEED_FACTOR : 1);
    m.lastX = m._x;
    m.lastY = m._y;

    const wantY = m._y + m.dirY * speed;
    const clampedY = clampEntityY(wantY, 6);
    // Off the walls it bounces rather than being held against them. Clamping a heading that runs
    // into the ceiling eats the vertical half of it, so a creature told to move at three times its
    // speed spent the frame crawling along the roof at a fraction of it. Reflected, the speed is
    // the speed, and running into a wall costs it its line rather than its pace.
    if (m.defensive && clampedY !== wantY) {
      m.bounce('y');
      m._y = clampEntityY(m._y + m.dirY * speed, 6);
    } else {
      m._y = clampedY;
    }

    if (m.defensive) {
      // The sides are walls too now, not a seam - see the note above about cornering it.
      const wantX = m._x + m.dirX * speed;
      const margin = MEGAMOUTH_WALL_MARGIN;
      if (wantX < margin || wantX > SIZE_X - margin) {
        m.bounce('x');
        m._x = Math.max(margin, Math.min(SIZE_X - margin, m._x + m.dirX * speed));
      } else {
        m._x = wantX;
      }
    } else {
      m._x += m.dirX * speed;
      // Round it goes while it is still only crossing. The margin is wide enough that it is fully
      // off before it reappears, so it never pops into existence halfway through its own body.
      if (m._x > SIZE_X + MEGAMOUTH_WRAP_MARGIN) m._x = -MEGAMOUTH_WRAP_MARGIN;
      else if (m._x < -MEGAMOUTH_WRAP_MARGIN) m._x = SIZE_X + MEGAMOUTH_WRAP_MARGIN;
    }

    this.drawMegamouth(m, now);
  }

  /**
   * Beaten, and going down.
   *
   * It sinks to the floor rather than swimming off, trailing blood the whole way, and once it is
   * on the bottom it stops entirely and simply bleeds. Nothing about it is a threat any more -
   * the level is already won by this point - so what is left is a decision rather than a fight:
   * one Boost finishes it, or it can be left where it lies.
   */
  private sinkMegamouth(m: Megamouth, now: number): void {
    const scale = WORLD_SCALE;
    const px = m._x * scale + scale / 2;
    const py = m._y * scale + scale / 2;
    m.lastX = m._x;
    m.lastY = m._y;

    if (!m.settled) {
      m._y = Math.min(MEGAMOUTH_SETTLE_Y, m._y + MEGAMOUTH_SINK_SPEED);
      // Still carrying the way it was going, but barely - it is falling more than it is swimming.
      m._x = Math.max(
        MEGAMOUTH_WALL_MARGIN,
        Math.min(SIZE_X - MEGAMOUTH_WALL_MARGIN, m._x + m.dirX * MEGAMOUTH_SINK_SPEED * 0.3),
      );
      if (now >= this.megamouthBleedAt) {
        this.megamouthBleedAt = now + MEGAMOUTH_TRAIL_MS;
        this.particles.emit('blood', px, py, 3, { speed: 0.3, life: 2.6, grow: 2.2 });
      }
      if (m._y >= MEGAMOUTH_SETTLE_Y) {
        m.settled = true;
        m.dirY = 0;
        // Everything it has left, at once, so the moment it touches down is the moment the water
        // goes red rather than a cloud that creeps up on the player.
        this.particles.emit('blood', px, py, 26, { speed: 1.1, life: 4, grow: 3 });
        this.setStatus('It settles on the bottom. Finish it, or leave it');
        this.showBanner('It Settles', 'storm', 2200);
      }
      return;
    }

    if (now >= this.megamouthBleedAt) {
      this.megamouthBleedAt = now + MEGAMOUTH_BLEED_MS;
      this.particles.emit('blood', px, py, 4, { speed: 0.4, life: 3, grow: 2.6 });
    }
  }

  /** Puts the sprite and its lights wherever the animal now is. */
  private drawMegamouth(m: Megamouth, now: number): void {
    const scale = WORLD_SCALE;
    const base = SHARK_BASE_SCALE * SHARK_KIND_SCALE.greatWhite * MEGAMOUTH_SIZE;
    const facing = m.dirX >= 0 ? 1 : -1;
    if (this.megamouthSprite) {
      this.megamouthSprite.x = m._x * scale + scale / 2;
      this.megamouthSprite.y = m._y * scale + scale / 2;
      // Nose down once it is beaten, and further once it is on the bottom: a thing lying on the
      // floor of the ocean does not lie level.
      this.megamouthSprite.rotation = m.beaten ? facing * (m.settled ? 0.16 : 0.09) : 0;
      const fish = this.megamouthSprite.getChildByName('fish') as Container | null;
      if (fish) fish.scale.set(base * facing, base);
    }
    if (this.megamouthLights) {
      this.megamouthLights.position.set(m._x * scale + scale / 2, m._y * scale + scale / 2);
      this.megamouthLights.rotation = this.megamouthSprite?.rotation ?? 0;
      // createPhotophores builds the dots but leaves placing them to the caller, exactly as the
      // shark draw loop does - so each one is put at its spot in the strip's own frame, scaled by
      // how big this thing is drawn and mirrored with whichever way it is swimming.
      for (let i = 0; i < this.megamouthLights.children.length; i++) {
        const dot = this.megamouthLights.children[i];
        const spot = MEGAMOUTH_PHOTOPHORES[i];
        if (!spot) continue;
        dot.position.set(spot.x * base * facing, spot.y * base);
        dot.scale.set(1.9);
      }
      // The lights go out as it does - down to a fraction of themselves once it is on the floor,
      // which is the only part of it still saying anything.
      const pulse = photophorePulseAlpha(now, 991);
      this.megamouthLights.alpha = m.beaten ? pulse * (m.settled ? 0.3 : 0.6) : pulse;
    }
  }

  /**
   * The moment the water empties and it realises it is the one left.
   *
   * Announced without naming it, like everything else down here - the banner says what changed,
   * not what it is - and the status line carries the two things the player now has to know, since
   * nothing else in the game asks for a pod this size or for three hits.
   */
  private turnMegamouthDefensive(): void {
    const m = this.megamouth;
    if (!m) return;
    m.defensive = true;
    if (this.megamouthTurnedAnnounced) return;
    this.megamouthTurnedAnnounced = true;
    sfx.playMegamouth();
    this.showBanner('It turns on you!', 'storm', 2200);
    this.setStatus(`${MEGAMOUTH_POD_REQUIREMENT} dolphins and three Boosts will bring it down`);
  }

  /**
   * Rams landing on the megamouth. Returns true on the blow that finishes it.
   *
   * A boosted pod of ten hurts it; anything less is swept aside by the branch below that costs a
   * dolphin, which is the same contact read the other way. A landed ram deliberately shares the
   * pod's hit cooldown, so a hit is never also a loss - swimming into it at speed with the pod
   * behind you is the answer to it, and it would be a strange answer that cost a dolphin a time.
   */
  private updateMegamouthCombat(): boolean {
    const m = this.megamouth;
    if (!m || !this.player) return false;
    const now = Date.now();
    if (now < this.megamouthHitCooldownUntil) return false;

    const contact = this.dolphins.some(
      (d) => (d.isPlayer || d.recruited) && m.distanceBetween(d) < MEGAMOUTH_HIT_RADIUS,
    );
    if (!contact) return false;

    // A beaten one asks for nothing but the dash. The pod has departed by then - clearing the
    // level sends it home - so holding the finisher to ten dolphins would be offering something
    // that could never be taken.
    const meetsPod = m.beaten || this.getPodSize() >= MEGAMOUTH_POD_REQUIREMENT;
    if (!meetsPod || !this.sprinting) {
      if (this.gameTime - this.lastBoostNudgeTime > 2) {
        this.lastBoostNudgeTime = this.gameTime;
        this.setStatus(
          meetsPod ? 'Boost into it!' : `You need ${MEGAMOUTH_POD_REQUIREMENT} dolphins to hurt it`,
        );
      }
      return false;
    }

    this.megamouthHitCooldownUntil = now + MEGAMOUTH_HIT_COOLDOWN_MS;
    this.playerHitCooldownUntil = Math.max(this.playerHitCooldownUntil, now + MEGAMOUTH_HIT_COOLDOWN_MS);
    m.hitsTaken++;

    const scale = WORLD_SCALE;
    this.particles.emit('hit', m._x * scale + scale / 2, m._y * scale + scale / 2, 20, { speed: 3.5, life: 0.7 });
    this.triggerBigKillFeedback('matriarch');

    if (m.hitsTaken > MEGAMOUTH_HITS_REQUIRED) {
      // The finisher. Only reachable once it is already beaten, when the pod has been sent home
      // and the level is won - so this one is landed by the player alone, for its own sake.
      this.destroyMegamouth(true);
      return true;
    }
    if (m.hitsTaken === MEGAMOUTH_HITS_REQUIRED) {
      this.beatMegamouth();
      return true;
    }
    this.flashMegamouthHit();
    this.setStatus(`The megamouth reels! (${m.hitsTaken}/${MEGAMOUTH_HITS_REQUIRED})`);
    this.showBanner('Direct Hit!', 'storm', 900);
    return false;
  }

  /**
   * The third hit: it stops being the thing the level is waiting on.
   *
   * It is not killed. The arena is won and the pod goes home, but the animal is still out there
   * and still swimming, and a player who wants it can take one more run at it on their own - see
   * the finisher in updateMegamouthCombat. Most will dive on, which is the point of offering it.
   */
  private beatMegamouth(): void {
    const m = this.megamouth;
    if (!m) return;
    m.beaten = true;
    m.settled = false;
    this.megamouthBleedAt = 0;
    this.flashMegamouthHit();
    this.setStatus('It breaks off and goes down');
    this.showBanner('It Breaks Off!', 'victory', 2200);
  }

  /** Flashes its sprite on a ram that didn't finish it - the same acknowledgement the Matriarch gets. */
  private flashMegamouthHit(): void {
    const sprite = this.megamouthSprite;
    const fish = sprite?.getChildByName('fish') as unknown as { tint: number } | undefined;
    if (!fish) return;
    [0xff4444, 0x14161f, 0xff4444, 0x14161f].forEach((tint, i) => {
      setTimeout(() => {
        if (this.megamouthSprite === sprite) fish.tint = tint;
      }, i * 90);
    });
  }

  /** The finishing blow: the lights go out first, then the body flashes and fades. */
  private destroyMegamouth(finisher = false): void {
    const sprite = this.megamouthSprite;
    this.sharksKilled++;
    this.registerKillSound();
    if (finisher) {
      this.awardRunPearls(MEGAMOUTH_FINISHER_PEARLS);
      this.setStatus('The megamouth is finished');
      this.showBanner(`Megamouth Down!  +${MEGAMOUTH_FINISHER_PEARLS} Pearls`, 'victory', 2400);
    } else {
      this.setStatus('The megamouth is beaten');
      this.showBanner('Megamouth Beaten!', 'victory', 2000);
    }
    // Cleared first so nothing keeps driving it, then the sprite is animated out on its own -
    // the same send-off a large shark gets, against a container this code now owns.
    this.megamouth = null;
    this.megamouthSprite = null;
    if (this.megamouthLights) {
      this.lightsContainer.removeChild(this.megamouthLights);
      this.megamouthLights.destroy({ children: true });
      this.megamouthLights = null;
    }
    if (!sprite) return;

    const fish = sprite.getChildByName('fish') as unknown as { tint: number } | null;
    const baseScaleX = sprite.scale.x;
    const baseScaleY = sprite.scale.y;
    const start = performance.now();
    const DURATION = 900;
    let lastFlash = 0;
    let flashOn = false;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION);
      if (fish && elapsed - lastFlash >= 70) {
        lastFlash = elapsed;
        flashOn = !flashOn;
        fish.tint = flashOn ? 0xffffff : 0xff2222;
      }
      const burst = 1 + Math.sin(t * Math.PI) * 0.35;
      sprite.scale.set(baseScaleX * burst, baseScaleY * burst);
      sprite.alpha = 1 - t;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityContainer.removeChild(sprite);
        sprite.destroy({ children: true });
      }
    };
    requestAnimationFrame(animate);
  }

  private clearKraken(): void {
    this.krakenContainer.removeChildren();
    for (const g of this.tentacleGfx.values()) g.destroy();
    for (const g of this.tentacleLightGfx.values()) {
      this.lightsContainer.removeChild(g);
      g.destroy();
    }
    this.tentacleGfx.clear();
    this.tentacleLightGfx.clear();
    this.tentacles = [];
  }

  /**
   * Sends every shark off the nearest side when the kraken arrives.
   *
   * It is the obvious thing for them to do and it solves a real problem: an arm closing a lane and
   * a shark hunting you down it are two hazards asking for the same square of water, and together
   * they read as noise rather than as either one. With the water cleared, the kraken is the whole
   * event - which is what something that size should be.
   *
   * They stay in `sharks` the entire time. Emptying the list would complete the level the moment
   * the event started, which is a considerably worse bug than any of this is worth.
   */
  private sendSharksAwayFromKraken(): void {
    for (const shark of this.sharks) {
      if (shark.krakenFlight !== 'none') continue;
      shark.homeX = shark._x;
      shark.homeY = shark._y;
      shark.fleeDir = shark._x < SIZE_X / 2 ? -1 : 1;
      shark.krakenFlight = 'leaving';
      // A shark part-way through a special stops doing it; it has somewhere else to be.
      shark.charging = false;
      shark.ambushing = false;
      shark.stalking = false;
      shark.lockPhase = 'none';
      shark.lockTarget = null;
      shark.reach = 0;
      shark.reachPhase = 'none';
    }
  }

  /** Calls them back once the arms are gone. */
  private callSharksBackAfterKraken(): void {
    for (const shark of this.sharks) {
      if (shark.krakenFlight === 'none') continue;
      shark.krakenFlight = 'returning';
      const sprite = this.sharkSprites.get(shark);
      if (sprite) sprite.visible = true;
    }
  }

  /**
   * Moves the sharks that are leaving or coming back, in place of their ordinary hunting.
   *
   * Returns true if this shark was handled here, so the caller knows to skip its normal move.
   */
  private updateKrakenFlight(shark: Shark, sharkSpeed: number): boolean {
    if (shark.krakenFlight === 'none') return false;
    const step = sharkSpeed * shark.speedMultiplier * KRAKEN_FLIGHT_SPEED;
    const sprite = this.sharkSprites.get(shark);

    if (shark.krakenFlight === 'leaving') {
      shark._x += shark.fleeDir * step;
      shark.headingX = shark.fleeDir;
      shark.headingY = 0;
      const past = shark.fleeDir === -1 ? shark._x < -KRAKEN_OFFSTAGE_MARGIN : shark._x > SIZE_X + KRAKEN_OFFSTAGE_MARGIN;
      if (past) {
        shark.krakenFlight = 'gone';
        if (sprite) sprite.visible = false;
      }
      return true;
    }

    if (shark.krakenFlight === 'gone') {
      if (sprite) sprite.visible = false;
      return true;
    }

    // Returning: swim back in toward where it was, and rejoin the level once it is home.
    const dx = shark.homeX - shark._x;
    const dy = shark.homeY - shark._y;
    const dist = Math.hypot(dx, dy);
    if (dist < step || dist === 0) {
      shark._x = shark.homeX;
      shark._y = shark.homeY;
      shark.krakenFlight = 'none';
      return true;
    }
    shark._x += (dx / dist) * step;
    shark._y = clampEntityY(shark._y + (dy / dist) * step, 4);
    shark.headingX = dx / dist;
    shark.headingY = dy / dist;
    return true;
  }

  private startKraken(): void {
    this.activeEvent = { type: 'kraken', endsAt: this.gameTime + KRAKEN_DURATION };
    this.clearKraken();
    const maxReach = SIZE_X * TENTACLE_REACH_SHARE;
    const now = Date.now();
    for (let i = 0; i < KRAKEN_ARMS; i++) {
      // Alternating sides, spread down the arena, so the arms never all close the same rows.
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const band = SIZE_Y / (KRAKEN_ARMS + 1);
      const anchorY = band * (i + 1) + (Math.random() - 0.5) * band * 0.5;
      const arm = new Tentacle(i, side, anchorY, maxReach);
      // Staggered starts, so the first reach is not three arms at once.
      arm.phaseEndsAt = now + Math.random() * TENTACLE_WAIT_MS;
      this.tentacles.push(arm);
      const g = new Graphics();
      this.krakenContainer.addChild(g);
      this.tentacleGfx.set(arm, g);
      const lights = new Graphics();
      this.lightsContainer.addChild(lights);
      this.tentacleLightGfx.set(arm, lights);
    }
    this.sendSharksAwayFromKraken();
    // No banner, and nothing named: what arrives is meant to be worked out from the water rather
    // than read off a label. The noise repeats though - it was distant five seconds ago and it is
    // on top of you now.
    this.setStatus('The sharks are scattering');
    sfx.playKraken();
  }

  private endKraken(): void {
    this.clearKraken();
    this.callSharksBackAfterKraken();
    this.activeEvent = null;
    this.setStatus('The arms withdraw - the sharks are coming back');
  }

  /**
   * Runs each arm's cycle: wait, telegraph, reach, hold, withdraw.
   *
   * `reach` is what both the drawing and the contact check read, so an arm is dangerous exactly as
   * far as it is drawn - there is no separate hit box to fall out of step with the picture.
   */
  private updateKraken(now: number): void {
    for (const arm of this.tentacles) {
      if (now < arm.phaseEndsAt) {
        // Mid-phase: move `reach` along for the two phases that travel.
        const left = arm.phaseEndsAt - now;
        if (arm.phase === 'reaching') arm.reach = Math.max(0, Math.min(1, 1 - left / TENTACLE_REACH_MS));
        else if (arm.phase === 'withdrawing') arm.reach = Math.max(0, Math.min(1, left / TENTACLE_WITHDRAW_MS));
        continue;
      }
      switch (arm.phase) {
        case 'waiting':
          arm.phase = 'telegraph';
          arm.phaseEndsAt = now + TENTACLE_TELEGRAPH_MS;
          break;
        case 'telegraph':
          arm.phase = 'reaching';
          arm.phaseEndsAt = now + TENTACLE_REACH_MS;
          break;
        case 'reaching':
          arm.reach = 1;
          arm.phase = 'holding';
          arm.phaseEndsAt = now + TENTACLE_HOLD_MS;
          break;
        case 'holding':
          arm.phase = 'withdrawing';
          arm.phaseEndsAt = now + TENTACLE_WITHDRAW_MS;
          break;
        case 'withdrawing': {
          arm.reach = 0;
          arm.phase = 'waiting';
          arm.phaseEndsAt = now + TENTACLE_WAIT_MS * (0.4 + Math.random() * 0.6);
          // A withdrawn arm comes back somewhere else. Rooted to one spot, three arms taught the
          // player three rows to avoid and the event was solved after one cycle; moving, the
          // question has to be asked again every time. It also picks its side afresh, so the
          // water it threatens is never the same twice running.
          arm.side = Math.random() < 0.5 ? -1 : 1;
          arm.anchorY = TENTACLE_EDGE_MARGIN + Math.random() * (SIZE_Y - TENTACLE_EDGE_MARGIN * 2);
          arm.wavePhase = Math.random() * Math.PI * 2;
          break;
        }
      }
    }
  }

  /** An arm only bites once it is past telegraphing - the warning has to be worth something. */
  private tentacleIsDangerous(arm: Tentacle): boolean {
    return arm.reach > 0.02 && arm.phase !== 'telegraph' && arm.phase !== 'waiting';
  }

  /**
   * Whether a point is inside an arm, measured along the arm rather than to its tip.
   *
   * The whole length hurts, not just the end: closest approach to the segment from the edge to the
   * tip is what the shape actually occupies, and testing only the tip would let a dolphin sit
   * inside a tentacle untouched.
   */
  private tentacleHits(arm: Tentacle, d: { _x: number; _y: number }): boolean {
    if (!this.tentacleIsDangerous(arm)) return false;
    const rootX = arm.side === -1 ? 0 : SIZE_X;
    const tipX = arm.tipX();
    const lo = Math.min(rootX, tipX);
    const hi = Math.max(rootX, tipX);
    if (d._x < lo - TENTACLE_HIT_RADIUS || d._x > hi + TENTACLE_HIT_RADIUS) return false;
    return Math.abs(d._y - arm.anchorY) <= TENTACLE_HIT_RADIUS;
  }

  private startJellyfishSwarm(): void {
    this.activeEvent = { type: 'jellyfish', endsAt: this.gameTime + JELLYFISH_SWARM_DURATION };
    this.lostAtSwarmStart = this.totalLost;
    this.swarmClearSince = 0;
    this.clearJellyfish();
    // Down in the twilight the swarm is a different animal: dark red, and flashing blue.
    const look = isMesopelagicLevel(this.currentLevel) ? DEEP_JELLYFISH : SHALLOW_JELLYFISH;
    this.swarmFlashes = look.luminous;
    for (let i = 0; i < JELLYFISH_COUNT; i++) {
      const y = 2 + Math.random() * (SIZE_Y - 4);
      const jelly = new Jellyfish(i, y);
      this.jellyfish.push(jelly);
      const sprite = createJellyfishSprite(look);
      this.jellyfishContainer.addChild(sprite);
      this.jellyfishSprites.set(jelly, sprite);
    }
    this.setStatus('Jellyfish swarm! Keep the pod moving');
    this.showBanner('Jellyfish Swarm!', 'storm', 2500);
  }

  private endJellyfishSwarm(): void {
    this.clearJellyfish();
    this.swarmClearSince = 0;
    this.activeEvent = null;
    this.setStatus('The swarm has passed');
    if (this.totalLost === this.lostAtSwarmStart) this.tryUnlock('throughTheSwarm');
  }

  /**
   * Whether the swarm has gone by: every jellyfish left is a clear margin behind every pod member.
   *
   * They drift one way only, so at the start - when they are off the right-hand edge and the pod
   * is in the arena - this is false by construction, and it cannot go true until the wall has
   * actually passed. True either way the pod gets through, whether it swam across and left them
   * behind or held still and let them wash over it.
   */
  private podIsClearOfSwarm(): boolean {
    const pod = this.podMembers();
    if (pod.length === 0) return false;
    return this.jellyfish.every((jelly) => pod.every((d) => jelly._x < d._x - SWARM_CLEAR_MARGIN));
  }

  private updateJellyfish(): void {
    const alive: Jellyfish[] = [];

    // Nothing left to be through: close it now rather than running the clock down on an empty
    // arena with the sharks still holding still.
    if (this.jellyfish.length === 0) {
      this.endJellyfishSwarm();
      return;
    }

    const clear = this.podIsClearOfSwarm();
    if (!clear) {
      this.swarmClearSince = 0;
    } else {
      if (this.swarmClearSince === 0) this.swarmClearSince = this.gameTime;
      if (this.gameTime - this.swarmClearSince >= SWARM_CLEAR_SECONDS) {
        this.setStatus('The swarm drifts away');
        this.endJellyfishSwarm();
        return;
      }
    }

    const allPast = this.dolphins.length > 0 && this.dolphins.every((d) => d._x > 70);
    const speedFactor = clear ? SWARM_CLEAR_SPEEDUP : allPast ? 2 : 1;
    for (const jelly of this.jellyfish) {
      jelly._x -= jelly.speed * speedFactor;
      if (jelly._x > -10) {
        alive.push(jelly);
      } else {
        const sprite = this.jellyfishSprites.get(jelly);
        if (sprite) {
          this.jellyfishContainer.removeChild(sprite);
          sprite.destroy();
          this.jellyfishSprites.delete(jelly);
        }
      }
    }
    this.jellyfish = alive;
  }

  /**
   * Redraws every arm from its current reach.
   *
   * The picture is built from the same `reach` the contact check reads, so an arm can never be
   * dangerous somewhere it is not drawn - the one thing a hazard like this must not do. Menace
   * fades in with the phase, so a telegraphing arm is visibly not yet the thing that hurts.
   */
  private drawKraken(now: number): void {
    if (this.tentacles.length === 0) return;
    const scale = WORLD_SCALE;
    const t = now / 1000;
    for (const arm of this.tentacles) {
      const g = this.tentacleGfx.get(arm);
      const lights = this.tentacleLightGfx.get(arm);
      if (!g || !lights) continue;
      const rootX = arm.side === -1 ? 0 : SIZE_X;
      const px = rootX * scale;
      const py = arm.anchorY * scale + scale / 2;
      g.position.set(px, py);
      lights.position.set(px, py);
      const lengthPx = arm.maxReach * arm.reach * scale;
      const menace = this.tentacleIsDangerous(arm) ? 1 : 0.25;
      // The direction alone does the mirroring: an arm rooted on the left grows into +x, one on
      // the right into -x. Flipping the Graphics as well would cancel on one side and double on
      // the other, which put every right-hand arm outside the arena.
      const dir = arm.side === -1 ? 1 : -1;
      // Same length, same direction, same instant for both halves, so the lights can never end up
      // somewhere the arm is not.
      drawTentacle(g, lengthPx, dir, t, arm.wavePhase, menace);
      drawTentacleLights(lights, lengthPx, dir, t, arm.wavePhase, menace);
    }
  }

  private drawJellyfish(): void {
    const scale = WORLD_SCALE;
    const now = Date.now();
    for (const [jelly, sprite] of this.jellyfishSprites) {
      sprite.x = jelly._x * scale + scale / 2;
      sprite.y = jelly._y * scale + scale / 2;
      // Only the deep swarm has an alarm to set off; the sunlit one is lit from outside and holds
      // whatever alpha it was drawn with.
      if (!this.swarmFlashes) continue;
      const glow = sprite.getChildByName('glow') as Container | null;
      if (glow) glow.alpha = jellyfishFlashAlpha(now, jelly.id);
    }
  }

  private startEvent(type: GameEventType): void {
    this.activeEvent = { type, endsAt: this.gameTime + EVENT_DURATION };
    if (type === 'storm') {
      this.setStatus('A storm rolls in: visibility reduced');
      this.showBanner('Storm Incoming!', 'storm', 2500);
      sfx.startStormRumble();
    }
  }

  private endEvent(): void {
    if (this.activeEvent?.type === 'storm') {
      this.setStatus('The storm has passed');
      this.showBanner('Storm Passed', 'storm', 2000);
      this.stormOverlay.clear();
      sfx.stopStormRumble();
      this.tryUnlock('stormSurvivor');
    } else if (this.activeEvent?.type === 'kraken') {
      this.endKraken();
      return;
    } else if (this.activeEvent?.type === 'megamouth') {
      this.endMegamouth();
      return;
    } else if (this.activeEvent?.type === 'jellyfish') {
      this.endJellyfishSwarm();
      return;
    }
    this.activeEvent = null;
  }

  /**
   * Picks what the next event will be, if anything.
   *
   * The two events are allowed at different depths rather than by one shared rule, because they
   * are doing different jobs. Whichever are allowed here share the roll evenly; if neither is,
   * the depth simply has no weather.
   */
  private planNextEvent(): void {
    if (isSandboxLevel(this.currentLevel)) {
      this.pendingEvent = BENCH_EVENT_ORDER[this.benchEventIndex % BENCH_EVENT_ORDER.length];
      this.benchEventIndex += 1;
      this.nextEventWarningTime = this.nextEventCheckTime - 5;
      this.eventWarningShown = false;
      return;
    }

    // Two events at every depth, sharing the roll evenly, so a kraken in the Mesopelagic comes up
    // exactly as often as a storm does in the sunlit water: the zones differ in what the weather
    // is, not in how much of it there is. The megamouth is deliberately not on this list - it is
    // dealt once a run rather than rolled for. See MEGAMOUTH_ENCOUNTER_FIRST_LEVEL.
    const allowed: GameEventType[] = [];
    if (this.stormsAllowed()) allowed.push('storm');
    if (this.jellyfishAllowed()) allowed.push('jellyfish');
    if (this.deepEventsAllowed()) allowed.push('kraken');

    const roll = Math.random();
    this.pendingEvent =
      allowed.length > 0 && roll < EVENT_CHANCE * 2
        ? allowed[Math.floor(Math.random() * allowed.length)]
        : null;

    this.nextEventWarningTime = this.nextEventCheckTime - 5;
    this.eventWarningShown = false;
  }

  /**
   * Storms: everywhere except the Mesopelagic.
   *
   * A storm is a visibility mechanic - it cuts sight to STORM_VISIBILITY_RADIUS - and that zone
   * already runs its own darkness, climbing from 0.35 to 0.62, with the photophores and
   * Echolocation built around reading it. Laying a storm over that changes almost nothing except
   * to take the tool the zone hands you and briefly make it useless, and a thunderstorm a
   * thousand metres down was never a thing anyone was going to believe.
   */
  private stormsAllowed(): boolean {
    return !isMesopelagicLevel(this.currentLevel);
  }

  /**
   * Jellyfish: level 19 and shallower, and never on a level with a Matriarch in it.
   *
   * They used to stop after level 5, so from level 6 down every event was a storm. A swarm is a
   * hazard to swim around rather than a fog to see through, which is the one kind of weather that
   * still means something in dark water - so it is the event the Mesopelagic keeps while storms
   * are off there.
   *
   * The boss levels are excluded by reading the level's own matriarch flag rather than by naming
   * 10 and 20, so any boss level added later is covered without this having to be remembered. A
   * Matriarch and a swarm at once are two things asking for the same attention, and the fight is
   * the thing the level is for.
   */
  private jellyfishAllowed(): boolean {
    if (this.currentLevel > JELLYFISH_MAX_LEVEL) return false;
    return !getLevelConfig(this.currentLevel).matriarch;
  }

  /**
   * The kraken: the Mesopelagic only, and never on a boss level.
   *
   * It is built around the zone's darkness - what you read is the lane it closes, not the arm
   * that closes it - so it would mean little in lit water. Paired with the jellyfish it takes
   * the slot the storm holds higher up, on the same roll and at the same rate: half the zone's
   * weather, which is exactly a storm's share of levels 1-9.
   *
   * The megamouth used to be gated here too. It is dealt once a run now rather than rolled for -
   * see megamouthEncounterDue.
   */
  private deepEventsAllowed(): boolean {
    if (!isMesopelagicLevel(this.currentLevel)) return false;
    return !getLevelConfig(this.currentLevel).matriarch;
  }

  /**
   * Whether this level carries the run's one megamouth.
   *
   * The rolled level is where it is *due*, not the only place it can happen: a level can end
   * before forty-five seconds are up, and a player who bought their way to a depth past the roll
   * should not have the encounter silently skipped. So it lands on the first level of the zone
   * at or after the roll, and only a fought-and-won encounter spends it.
   */
  private megamouthEncounterDue(level: number): boolean {
    if (this.megamouthDone || this.megamouthRunLevel === null) return false;
    if (isSandboxLevel(level) || !isMesopelagicLevel(level)) return false;
    if (getLevelConfig(level).matriarch) return false;
    return level >= this.megamouthRunLevel;
  }

  /** Which bench event comes next. Advanced by planNextEvent, reset with the level. */
  private benchEventIndex = 0;

  /** When the beaten megamouth next lets go of a cloud of blood. */
  private megamouthBleedAt = 0;

  /** When the pod first got clear of the swarm, in seconds of play. 0 while it is still in it. */
  private swarmClearSince = 0;
  /** Whether the swarm in the water is the deep kind, which flashes rather than glowing. */
  private swarmFlashes = false;

  /** Level 5's one cry from below: when it is due, whether it has sounded, and how long it holds. */
  private deepCryAt = Infinity;
  private deepCryDone = false;
  private deepCryUntil = 0;

  /**
   * True while the cry is sounding, when nothing in the water hunts, hides, strikes or bites.
   *
   * Everything a shark does is suspended together rather than only its movement: a cloak that
   * dropped, a cookiecutter that completed its run or a bite that landed in the middle of the
   * arena holding still would each read as the pause being decorative. The pod is deliberately
   * left free to swim - the stillness is meant to be something the player moves through.
   */
  private waterIsListening(now: number): boolean {
    return now < this.deepCryUntil;
  }

  /**
   * The two things that are placed at a time rather than rolled for: level 5's cry from below,
   * and the run's one megamouth.
   *
   * Both used to be set up in initModel, which turns out to be the wrong place: a fresh start and
   * a retry go through it, and playing from one level to the next does not. So in an actual
   * descent the megamouth was never dealt at all, and the cry fired on the first tick of level 5 -
   * `gameTime` is a run clock rather than a level clock, so by the time a player had played four
   * levels it was already long past the mark and the check was true the moment the level opened.
   *
   * Here instead, in the one function every level entry really does call, and measured forward
   * from the current clock exactly the way the Matriarch's own timers above are.
   */
  private beginLevelSetPieces(config: LevelConfig): void {
    this.deepCryDone = false;
    this.deepCryUntil = 0;
    this.deepCryAt = config.level === DEEP_CRY_LEVEL ? this.gameTime + DEEP_CRY_AT : Infinity;

    this.megamouthAppearedThisLevel = false;
    this.megamouthEncounterScheduled = this.megamouthEncounterDue(config.level);
    if (this.megamouthEncounterScheduled) {
      this.nextEventCheckTime = this.gameTime + MEGAMOUTH_ENCOUNTER_AT;
      this.pendingEvent = 'megamouth';
      this.nextEventWarningTime = this.nextEventCheckTime - 5;
      this.eventWarningShown = false;
    }
  }

  /**
   * Whether the level has come down to the megamouth and the pod: it has turned on them and has
   * not yet been beaten. Not simply "a megamouth exists" - while it is still crossing there are
   * sharks in the water and the level is an ordinary level.
   */
  private inTheMegamouthFight(): boolean {
    return !!this.megamouth && this.megamouth.defensive && !this.megamouth.beaten;
  }

  /** Whether there is still a megamouth out there that the level is waiting on. */
  private megamouthHoldsTheLevel(): boolean {
    return !!this.megamouth && !this.megamouth.beaten;
  }

  /** Sounds the cry, once, when level 5 reaches DEEP_CRY_AT. */
  private updateDeepCry(): void {
    if (this.deepCryDone || this.gameTime < this.deepCryAt) return;
    this.deepCryDone = true;
    this.deepCryUntil = Date.now() + DEEP_CRY_MS;
    sfx.playKraken();
    this.setStatus('Something sounded from the deep');
    this.showBanner('Something sounded from the deep', 'storm', DEEP_CRY_MS);
  }

  private updateEvents(): void {
    if (this.activeEvent) {
      if (this.gameTime >= this.activeEvent.endsAt) this.endEvent();
      return;
    }
    if (this.gameTime >= this.nextEventCheckTime) {
      if (this.pendingEvent === 'storm') {
        this.startEvent('storm');
      } else if (this.pendingEvent === 'jellyfish') {
        this.startJellyfishSwarm();
      } else if (this.pendingEvent === 'kraken') {
        this.startKraken();
      } else if (this.pendingEvent === 'megamouth') {
        // Never two. A second arrival would call clearMegamouth on the first and quietly delete
        // a creature the level is waiting on - along with whatever damage had been done to it -
        // so while one is still in the water the roll simply passes.
        if (!this.megamouth) this.startMegamouth();
      }
      this.nextEventCheckTime += isSandboxLevel(this.currentLevel) ? BENCH_EVENT_INTERVAL : EVENT_CHECK_INTERVAL;
      this.planNextEvent();
    } else if (this.pendingEvent && this.gameTime >= this.nextEventWarningTime && !this.eventWarningShown) {
      this.eventWarningShown = true;
      this.announcePendingEvent(this.pendingEvent);
    }
  }

  /**
   * The five seconds of notice before an event lands.
   *
   * The two deep-water events share a line, and deliberately a vague one: what is coming is not
   * named because not knowing which of the two it is - an arena closing in, or something enormous
   * crossing it - is most of what makes the wait worth anything. A storm keeps its own wording,
   * since it says what it is and has since long before either of these existed.
   */
  private announcePendingEvent(type: GameEventType): void {
    if (type === 'storm') {
      this.setStatus('Storm approaching in 5 seconds');
      return;
    }
    if (type === 'jellyfish') {
      this.setStatus('Something is drifting this way');
      return;
    }
    this.setStatus('A strange noise came from the deep');
    this.showBanner('A strange noise came from the deep', 'storm', 2600);
    // The kraken recording is the noise from the deep, and the same one for either event - which
    // is what keeps it a question rather than an announcement. It plays again when the arms
    // actually arrive; the file is trimmed to 4.85s so the two never overlap across the five
    // seconds between them.
    sfx.playKraken();
  }

  private updateMatriarch(): void {
    if (this.matriarchSpawnTime === 0) return;
    if (!this.matriarchWarningShown && this.gameTime >= this.matriarchWarningTime) {
      this.matriarchWarningShown = true;
      this.setStatus('Matriarch approaching in 5 seconds');
      this.showBanner('Matriarch Approaching!', 'storm', 2500);
    }
    if (!this.matriarch && this.gameTime >= this.matriarchSpawnTime) {
      this.spawnMatriarch();
    }
    if (this.matriarch) {
      const smallRemaining = this.sharks.some((s) => s !== this.matriarch && !s.large);
      if (!smallRemaining) {
        if (!this.matriarchSmallCleared) {
          this.matriarchSmallCleared = true;
          this.matriarchSpawnerTimer = this.gameTime + 20;
        } else if (this.gameTime >= this.matriarchSpawnerTimer) {
          this.spawnMatriarchShark();
          this.matriarchSpawnerTimer = this.gameTime + 20;
        }
      }

      // Mega Pod only unlocks once every escort - large ones included, not just the small
      // sharks tracked above - is destroyed, so it can't be used as a shortcut past them. No
      // totalDolphinsSaved gate here deliberately: she's only killable via this button in
      // Campaign mode, so it must always appear once escorts are cleared, even with 0 saved
      // (summoning would then just add no dolphins but still land the finishing blow) -
      // otherwise a 0-total run could never defeat her at all.
      if (this.mode === 'campaign' && !this.megaPodAvailable) {
        const escortsRemaining = this.sharks.some((s) => s !== this.matriarch);
        if (!escortsRemaining) {
          this.megaPodAvailable = true;
          this.megaPodBtnWrap?.classList.remove('hidden');
          this.setStatus('The dolphins you saved are ready to be summoned!');
        }
      }

      // Once she's the last shark standing (every escort destroyed), she picks up speed and the
      // same charge/sprint ability large great whites get (see Shark.move in entities.ts).
      if (!this.matriarchEnraged && this.sharks.length === 1 && this.sharks[0] === this.matriarch) {
        this.matriarchEnraged = true;
        this.matriarch.enraged = true;
        this.matriarch.speedMultiplier = GREAT_WHITE_LARGE_SPEED_BONUS;
        this.setStatus('The Matriarch is enraged!');
        this.showBanner('The Matriarch is Enraged!', 'storm', 2200);
      }
    }
  }

  private movePlayer(): void {
    if (!this.player) return;
    // Shrimp stack additively with the Store's Speed upgrade rather than multiplying with it.
    const maxSpeed = 2 * (1 + this.speedBonusPct + this.shrimpSpeedBonus) * (this.sprinting ? SPRINT_SPEED : 1);

    // dx/dy is a unit direction; throttle (0..1) scales the step so a half-pushed
    // joystick / a touch near the centre moves slower than a full deflection.
    let dx = 0;
    let dy = 0;
    let throttle = 1;

    if (this.pointerActive) {
      // pointerDirX/Y is an analog vector from main.ts: ~0 at rest, magnitude ~1 at
      // full deflection (joystick edge, or a touch ~45% of the way to the canvas edge).
      const mag = Math.hypot(this.pointerDirX, this.pointerDirY);
      const DEAD_ZONE = 0.12;
      if (mag > DEAD_ZONE) {
        dx = this.pointerDirX / mag;
        dy = this.pointerDirY / mag;
        // Remap deflection [DEAD_ZONE, 0.9] onto speed [0.35, 1]: a light touch still
        // moves at a usable pace, and full speed is reached just before the edge.
        const t = Math.min(1, (mag - DEAD_ZONE) / (0.9 - DEAD_ZONE));
        throttle = 0.35 + t * 0.65;
      }
    } else {
      if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) dy -= 1;
      if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) dy += 1;
      if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) dx -= 1;
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dx += 1;
      const mag = Math.hypot(dx, dy);
      if (mag > 0) {
        dx /= mag; // normalise so a diagonal isn't ~1.4x faster than a cardinal
        dy /= mag;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const step = maxSpeed * throttle;
      const rawX = this.player._x + dx * step;
      if (this.awaitingNewWaters && dx > 0 && rawX >= SIZE_X) {
        this.player._x = 2;
        this.player.lastX = 2;
        this.advanceLevel().catch((err) => console.warn('Level transition failed:', err));
      } else {
        this.player._x = wrapX(rawX);
      }
      this.player._y = clampEntityY(this.player._y + dy * step, 2);
    }
  }

  private step(): void {
    // Cancel whatever tick was already queued. step() both schedules the next tick and is called
    // directly by anything restarting the loop, so without this a caller that restarts a loop
    // which had never actually stopped leaves two chains running, each scheduling its own next
    // tick - and the simulation runs at twice the speed, then three times, and so on.
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.running || this.awaitingLevelUpChoice || this.awaitingSharkWarning || this.awaitingRunSummary || this.awaitingTutorialHint || this.awaitingMilestone || this.awaitingContinue) return;

    // Hit-stop: keep the loop alive but freeze the simulation for a beat after a big kill.
    if (Date.now() < this.hitStopUntil) {
      this.lastFrameTime = 0;
      this.timer = setTimeout(() => this.step(), 16);
      return;
    }

    const sharkSpeed = parseInt(this.sharkSpeedInput.value, 10) || 1;

    const now = Date.now();

    // The level's opening invulnerability is granted here, on the first tick that actually runs,
    // rather than when the level was set up. A level commonly begins behind a level banner, a
    // "New Shark Spotted!" card or the Mega Shrimp choice, and every one of those halts this
    // loop (see the guard above) while the wall clock keeps running - on the later levels, where
    // those cards are most common and the sharks converge fastest, the entire window could
    // elapse before the player was ever allowed to move.
    if (this.pendingLevelInvulnerability && this.player) {
      this.pendingLevelInvulnerability = false;
      this.player.invulnerableUntil = now + LEVEL_START_INVULNERABILITY_MS;
      this.levelStartSafeUntil = this.player.invulnerableUntil;
    }

    // Coming back into view is worth announcing - the sharks have not moved on the player for
    // half a minute and are about to, and nothing else on screen would have told them.
    if (this.ghostUntil > 0 && now >= this.ghostUntil) {
      this.ghostUntil = 0;
      this.setStatus('The sharks can see you again');
      this.showBanner('Visible!', 'lost', 1400);
    }

    if (now >= this.sprintEndTime) this.sprinting = false;
    if (this.keys[' ']) this.startSprint(now, true);

    this.movePlayer();
    for (const dolphin of this.dolphins) {
      if (!dolphin.isPlayer && !dolphin.recruited) dolphin.move(this.sharks);
    }
    this.moveFollowers();

    // Nothing hunts while the cry sounds - see waterIsListening.
    if (this.activeEvent?.type !== 'jellyfish' && !this.waterIsListening(now)) {
      this.updateCloaks(now);
      // Once every remaining shark is large, none of them lose track any more: the end of a
      // level becomes a chase rather than hide-and-seek. Great whites and hammerheads already
      // track the player from anywhere; this is what brings large tigers up to that, and is the
      // behaviour the README and the shark guide have always described.
      const allSharksLarge = this.sharks.length > 0 && this.sharks.every((s) => s.large);
      // A Ghost Shrimp overrides all of that: nothing in the water can sense the pod, however
      // large or far-sighted it is.
      const ghosted = now < this.ghostUntil;
      // Both run before the sharks move, so a strike that starts this tick is already committed
      // when the shark is asked where to go.
      if (!ghosted) {
        this.updateLockOnStrikes(now);
        this.updateFrilledReach(now);
      }
      for (const shark of this.sharks) {
        // Leaving, gone or coming back: the kraken owns the water, so nothing else steers.
        if (this.updateKrakenFlight(shark, sharkSpeed)) continue;
        // A shark mid-run is not steering any more; it is going where it aimed.
        if (shark.lockPhase === 'zoom') {
          this.moveLockedShark(shark, sharkSpeed);
          continue;
        }
        const unlimitedRange = allSharksLarge || shark.kind === 'greatWhite' || shark.kind === 'hammerhead';
        shark.move(sharkSpeed, this.player, this.sharks, unlimitedRange, now, ghosted);
      }
    }

    if (this.player) {
      for (const dolphin of this.dolphins) {
        if (dolphin.isPlayer || dolphin.recruited) continue;
        if (this.dolphins.some((d) => (d.isPlayer || d.recruited) && d.distanceBetween(dolphin) <= 4)) {
          dolphin.recruited = true;
          this.totalRecruited++;
          this.setStatus('Dolphin recruited');
          this.showBanner('Dolphin Recruited!', 'recruited', 2000);
          sfx.playRecruit();
          this.tryUnlock('firstRecruit');
          break;
        }
      }
    }

    const scale = WORLD_SCALE;

    const canSchool = this.getPodSize() >= HUNTING_MODE_POD_SIZE;

    if (this.huntingMode && !canSchool) {
      this.huntingMode = false;
      this.setStatus('Hunting mode lost');
      this.updateHuntingVisuals();
      this.onSchoolingChange?.(false);
      // Arm the auto-form again for the pod you rebuild. This latch used to be per level, so
      // losing your pod below the threshold once meant Hunting Mode never came back on its own
      // - every shark stayed indestructible for the rest of the level however many dolphins you
      // recruited, while the hint still promised the pod forms automatically.
      this.autoFormedForThisPod = false;
    }

    if (canSchool && !this.huntingMode && !this.readyToSchool) {
      this.readyToSchool = true;
      this.schoolBtnWrap.classList.remove('hidden');
      this.setStatus('Pod ready! Tap Form Pod to hunt sharks');
      this.queueTutorialHint(
        'formPod',
        'Pod Ready!',
        `Your pod has reached ${HUNTING_MODE_POD_SIZE} dolphins. Tap Form Pod (or just keep swimming - it forms automatically) to enter Hunting Mode and start destroying sharks.`
      );
    } else if (!canSchool && this.readyToSchool) {
      this.readyToSchool = false;
      this.schoolBtnWrap.classList.add('hidden');
    }

    if (!this.autoFormedForThisPod && this.player && this.player.invulnerableUntil <= Date.now() && canSchool && !this.huntingMode) {
      this.autoFormedForThisPod = true;
      this.formSchool();
      this.setStatus('Pod Formed');
      this.showBanner('Pod Formed!', 'victory', 1500);
    }

    // First time the pod is actually strong enough to hurt a large shark, say so before the
    // player has to work it out by bouncing off one. The Matriarch is excluded - she needs the
    // Mega Pod rather than an ordinary Boost, and has her own dedicated fight.
    if (this.huntingMode) {
      const readyTarget = this.sharks.find(
        (s) => s.large && !s.matriarch && !s.isOffStage() && this.getPodSize() >= this.sharkPodRequirement(s.kind, s.large)
      );
      if (readyTarget) {
        this.queueTutorialHint(
          'largeShark',
          'Big Shark!',
          'Your pod is big enough to take this one down. Ram it while Boosting - a plain hit does nothing, you need to be Boosting at the moment you hit it.'
        );
      }
    }

    if (this.activeEvent?.type !== 'jellyfish' && this.huntingMode) {
      const survivingSharks: Shark[] = [];
      let matriarchJustDefeated = false;
      for (const shark of this.sharks) {
        // Any pod member landing the hit counts, not just the dolphin you're steering, and the
        // whole tick counts, not just where everyone ended up on it - a boosting pod covers
        // several units per tick and used to sail straight through a shark without connecting.
        const ramRadius = this.sharkRamRadius(shark);
        const hitsAnyDolphin =
          !shark.isOffStage() && this.dolphins.some((d) => sweptDistance(shark, d) < ramRadius);

        // In Campaign mode the Matriarch can only be hurt while the Mega Pod is active, and only
        // by sprinting into her - each ram flashes her and counts toward MATRIARCH_HITS_REQUIRED,
        // with the final one landing the actual finishing blow (see finishMatriarchWithMegaPod).
        if (shark === this.matriarch && this.mode === 'campaign') {
          if (this.megaPodActive && hitsAnyDolphin && this.sprinting && Date.now() >= this.matriarchHitCooldownUntil) {
            this.matriarchHitCooldownUntil = Date.now() + MATRIARCH_HIT_COOLDOWN_MS;
            this.matriarchHitsTaken++;
            this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
            this.triggerBigKillFeedback('matriarch');
            if (this.matriarchHitsTaken >= MATRIARCH_HITS_REQUIRED) {
              matriarchJustDefeated = true;
            } else {
              this.flashMatriarchHit(shark);
              this.setStatus(`The Matriarch reels! (${this.matriarchHitsTaken}/${MATRIARCH_HITS_REQUIRED})`);
              this.showBanner('Matriarch Hit!', 'storm', 900);
              survivingSharks.push(shark);
            }
          } else {
            survivingSharks.push(shark);
          }
          continue;
        }

        // Large sharks (Endless Matriarch included) need a big enough pod AND a Sprint at
        // the moment of contact - a plain ram no longer works. Only this.sprinting counts;
        // the Magic-Shrimp speed boost deliberately does not.
        const meetsPod = this.getPodSize() >= this.sharkPodRequirement(shark.kind, shark.large);
        const canDestroy = hitsAnyDolphin && meetsPod && (!shark.large || this.sprinting);
        if (!canDestroy) {
          if (hitsAnyDolphin && meetsPod && shark.large && !this.sprinting && this.gameTime - this.lastBoostNudgeTime > 2) {
            this.lastBoostNudgeTime = this.gameTime;
            this.setStatus('Boost into it!');
          }
          survivingSharks.push(shark);
        } else if (shark === this.matriarch && this.mode === 'endless') {
          this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
          this.triggerBigKillFeedback('matriarch');
          this.fleeMatriarch(shark);
        } else {
          this.particles.emit('hit', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 16, { speed: 3, life: 0.6 });
          this.sharksKilled++;
          this.registerKillSound();
          if (shark.large) {
            this.playSharkDeathAnimation(shark);
            this.triggerBigKillFeedback();
          } else {
            this.removeSharkSprite(shark);
          }
          this.tryUnlock('firstHuntingKill');
        }
      }
      this.sharks = survivingSharks;
      if (matriarchJustDefeated) {
        this.finishMatriarchWithMegaPod();
      } else if (this.sharks.length === 0 && !this.megamouthHoldsTheLevel() && !this.levelCompleted) {
        // A megamouth in the water holds the level open until it has taken its three. It is the
        // only thing here that is not in `sharks` and still has to be dealt with.
        this.levelComplete();
      } else if (this.matriarch && !this.sharks.includes(this.matriarch) && !this.levelCompleted) {
        this.sharksKilled += this.sharks.length;
        if (this.sharks.length > 0) this.triggerBigKillFeedback();
        for (const s of this.sharks) {
          if (s.large) this.playSharkDeathAnimation(s);
          else this.removeSharkSprite(s);
        }
        this.sharks = [];
        if (this.mode !== 'endless') this.tryUnlock('matriarchSlayer');
        this.levelComplete();
      }
    }

    if (this.activeEvent?.type !== 'jellyfish' && !this.waterIsListening(now)) {
      if (this.player && now >= this.playerHitCooldownUntil && now >= this.player.invulnerableUntil && now >= this.ghostUntil) {
        for (const shark of this.sharks) {
          // Still full from the last one. Checked before contact so a shark parked in the pod
          // cannot feed again on the next tick - see SHARK_FEED_COOLDOWN_MS.
          if (now < shark.feedCooldownUntil) continue;
          if (this.sharkContactsPod(shark)) {
            sfx.playBite();
            // The Matriarch takes two pod members per bite; every other shark takes one.
            const bite = shark.matriarch ? 2 : 1;
            const victims: Dolphin[] = [];
            // A cookiecutter that ran this dolphin down takes that one. Anything else about the
            // bite is unchanged - including that it cannot take the player this way, who is lost
            // through the extra-life branch below rather than by being removed from the pod.
            const locked = shark.lockTarget;
            if (
              locked &&
              !locked.isPlayer &&
              locked.recruited &&
              now >= locked.invulnerableUntil &&
              this.dolphins.includes(locked) &&
              sweptDistance(this.sharkBitePoint(shark), locked) < this.sharkHitRadius(shark)
            ) {
              victims.push(locked);
            }
            for (let i = this.dolphins.length - 1; i >= 0 && victims.length < bite; i--) {
              const candidate = this.dolphins[i];
              if (victims.includes(candidate)) continue;
              if (!candidate.isPlayer && candidate.recruited && now >= candidate.invulnerableUntil) {
                victims.push(candidate);
              }
            }
            if (victims.length > 0) {
              this.playerHitCooldownUntil = now + 1000;
              shark.feedCooldownUntil = now + SHARK_FEED_COOLDOWN_MS;
              this.resetKillCombo();
              // Feeding gives a cloaked tiger away - it surfaces and has to recharge.
              this.revealShark(shark, now);
              for (const v of victims) {
                this.particles.emit('hit', v._x * scale + scale / 2, v._y * scale + scale / 2, 12, { speed: 2, life: 0.6 });
                this.removeDolphinSprite(v);
                this.totalLost++;
                this.lostThisLevel++;
              }
              this.dolphins = this.dolphins.filter((d) => !victims.includes(d));
              const many = victims.length > 1;
              this.setStatus(many ? `${victims.length} dolphins lost!` : 'A dolphin was lost');
              this.showBanner(many ? `${victims.length} Dolphins Lost!` : 'Dolphin Lost!', 'lost', 2000);
            } else if (this.vitalityLives > 0) {
              this.vitalityLives -= 1;
              this.playerHitCooldownUntil = now + 1000;
              this.player.invulnerableUntil = now + 3000;
              this.setStatus('Extra life used!');
              this.showBanner('Extra Life!', 'recruited', 2000);
            } else {
              this.gameOver();
              return;
            }
            // On the last life: pod down to just the player, no extra lives left. Clearing
            // the level from here unlocks Comeback (checked in levelComplete()).
            if (this.getPodSize() === 1 && this.vitalityLives === 0) {
              this.wasOnLastLifeThisLevel = true;
            }
            break;
          }
        }
      }
    }

    // The kraken and the megamouth take a dolphin the same way a sting does, and go through the
    // same hit cooldown, so no hazard can strip a pod faster than one member a second. Unlike the
    // swarm, these two run alongside the sharks rather than instead of them: a swarm fills the
    // whole arena, while an arm closes a lane and a megamouth occupies a line, and there is still
    // room to be hunted in between.
    const krakenOut = this.activeEvent?.type === 'kraken';
    if (this.player && (krakenOut || (this.megamouth && !this.megamouth.beaten))) {
      const grabbed = (d: Dolphin): boolean => krakenOut && this.tentacles.some((arm) => this.tentacleHits(arm, d));
      // A beaten one takes nobody. It is bleeding out on the floor, not crossing the arena.
      const swept = (d: Dolphin): boolean =>
        !!this.megamouth && !this.megamouth.beaten && this.megamouth.distanceBetween(d) < MEGAMOUTH_HIT_RADIUS;
      const now = Date.now();
      if (now >= this.playerHitCooldownUntil && now >= this.ghostUntil) {
        const victim = this.pickHazardVictim(
          (d) => now >= d.invulnerableUntil && (grabbed(d) || swept(d)),
        );
        if (victim) {
          const byArm = grabbed(victim);
          const caught = byArm ? 'Grabbed!' : 'Swept aside!';
          // A megamouth gives the pod longer to recover than an arm does - see the note on
          // MEGAMOUTH_SWEEP_COOLDOWN_MS.
          this.playerHitCooldownUntil = now + (byArm ? 1000 : MEGAMOUTH_SWEEP_COOLDOWN_MS);
          sfx.playBite();
          if (victim.isPlayer) {
            if (this.vitalityLives > 0) {
              this.vitalityLives -= 1;
              this.player.invulnerableUntil = now + 3000;
              this.setStatus('Extra life used!');
              this.showBanner('Extra Life!', 'recruited', 2000);
            } else {
              this.gameOver();
              return;
            }
          } else {
            this.particles.emit('hit', victim._x * scale + scale / 2, victim._y * scale + scale / 2, 14, { speed: 2, life: 0.6 });
            this.removeDolphinSprite(victim);
            this.dolphins = this.dolphins.filter((d) => d !== victim);
            this.totalLost++;
            this.lostThisLevel++;
            this.resetKillCombo();
            this.setStatus('A dolphin was taken');
            this.showBanner(caught, 'lost', 1800);
          }
        }
      }
    }

    // One sting a second for the whole pod, not one a tick. The cooldown used to be applied only
    // when the player was the one stung, so a pod crossing a dense swarm could lose a dolphin on
    // every frame - twelve a second - while the rule the other two hazards are written to says a
    // pod cannot be stripped faster than one member a second. Guarded rather than returned on:
    // the frame's clock is advanced further down and must not be skipped.
    if (this.activeEvent?.type === 'jellyfish' && this.player && now >= this.playerHitCooldownUntil) {
      for (const jelly of this.jellyfish) {
        const victim = this.pickHazardVictim((d) => jelly.distanceBetween(d) < 2.5);
        if (!victim) continue;
        if (victim.isPlayer && now < this.player.invulnerableUntil) continue;
        this.playerHitCooldownUntil = now + 1000;
        sfx.playBite();
        if (victim.isPlayer) {
          if (this.vitalityLives > 0) {
            this.vitalityLives -= 1;
            this.player.invulnerableUntil = now + 3000;
            this.setStatus('Sting resisted!');
            this.showBanner('Extra Life!', 'recruited', 2000);
          } else {
            this.gameOver();
            return;
          }
        } else {
          this.particles.emit('hit', victim._x * scale + scale / 2, victim._y * scale + scale / 2, 12, { speed: 2, life: 0.6 });
          this.removeDolphinSprite(victim);
          this.dolphins = this.dolphins.filter((d) => d !== victim);
          this.totalLost++;
          this.lostThisLevel++;
          this.setStatus('A dolphin was stung');
          this.showBanner('Dolphin Stung!', 'lost', 2000);
        }
        break;
      }
    }

    // Clamp the frame delta: a resume from pause already contributes 0 (lastFrameTime is
    // reset to 0), and this caps a backgrounded-tab / GC stall so the world doesn't
    // fast-forward - it just runs slow for a moment instead.
    const dt = this.lastFrameTime === 0 ? 0 : Math.min((now - this.lastFrameTime) / 1000, 0.25);
    this.lastFrameTime = now;
    this.gameTime += dt;
    this.runElapsed += dt;

    // Lifetime stats: count this frame's play time, record the play-day once per run,
    // and flush accumulated totals to storage every ~20s so a force-quit loses little.
    this.unsyncedPlaySeconds += dt;
    if (!this.playDayRecorded) {
      this.playDayRecorded = true;
      if (recordPlayDay() >= 7) this.tryUnlock('devoted');
    }
    if (this.gameTime >= this.lifetimeFlushAt) {
      this.lifetimeFlushAt = this.gameTime + 20;
      this.flushLifetimeStats();
    }

    this.updateEvents();
    this.updateDeepCry();
    this.updateMatriarch();

    if (this.activeEvent?.type === 'jellyfish') {
      this.updateJellyfish();
    } else if (this.activeEvent?.type === 'kraken') {
      this.updateKraken(Date.now());
    }
    // Not tied to the event window: the arrival is the event, the animal stays until it is beaten.
    // The combat runs outside Hunting Mode too - once the level is won there is no pod left to be
    // in Hunting Mode, and the optional finisher still has to be able to land.
    if (this.megamouth) {
      this.updateMegamouth(Date.now());
      if (this.activeEvent?.type !== 'jellyfish') this.updateMegamouthCombat();
    }

    // Nothing swims into a kraken. The water is cleared of sharks for it, and a lone dolphin
    // wandering in to be recruited while the arms are out reads as the sea not having noticed -
    // so the spawn clock is pushed along instead of firing, which also stops a backlog building
    // up and emptying into the arena the moment the event ends.
    if (this.activeEvent?.type === 'kraken') {
      while (this.gameTime >= this.nextDolphinSpawnTime) this.nextDolphinSpawnTime += this.dolphinSpawnInterval;
    } else if (this.gameTime >= this.nextDolphinSpawnTime && this.dolphins.length < this.maxDolphins) {
      const hasStray = this.dolphins.some((d) => !d.isPlayer && !d.recruited);
      if (!hasStray) {
        this.spawnRecruitableDolphin();
        // Quicker while the megamouth fight is on, and only while it is on - see
        // MEGAMOUTH_FIGHT_SPAWN_INTERVAL.
        this.nextDolphinSpawnTime += this.inTheMegamouthFight()
          ? Math.min(this.dolphinSpawnInterval, MEGAMOUTH_FIGHT_SPAWN_INTERVAL)
          : this.dolphinSpawnInterval;
      }
    }

    this.bubbleTimer += dt;
    if (this.bubbleTimer > 0.25) {
      this.bubbleTimer = 0;
      const bx = Math.random() * CANVAS_W;
      this.particles.emitDirected('bubble', bx, CANVAS_H, 1, 0, -1, { speed: 0.8 + Math.random() * 1.2, life: 2 + Math.random() * 2 });
    }

    if (this.player && dt > 0) {
      if (Math.random() < 0.5) {
        this.particles.emit('wake', this.player._x * scale + scale / 2, this.player._y * scale + scale / 2, 1, { speed: 0.6, life: 0.4 });
      }
    }
    for (const dolphin of this.dolphins) {
      if (dolphin.isPlayer) continue;
      if (Math.random() < 0.18) {
        this.particles.emit('wake', dolphin._x * scale + scale / 2, dolphin._y * scale + scale / 2, 1, { speed: 0.5, life: 0.35 });
      }
    }
    for (const shark of this.sharks) {
      if (Math.random() < 0.12) {
        this.particles.emit('wake', shark._x * scale + scale / 2, shark._y * scale + scale / 2, 1, { speed: 0.7, life: 0.45 });
      }
    }

    // The camera leans against the player's movement and decays back to centre when they stop.
    // directionDelta keeps it wrap-safe: crossing the seam is a small step, not a jump across
    // the whole world, which a position-based parallax would read as the camera being flung.
    if (this.player) {
      const leanX = directionDelta(this.player._x, this.player.lastX);
      const leanY = this.player._y - this.player.lastY;
      this.parallaxLeanX = Math.max(-1, Math.min(1, this.parallaxLeanX * 0.9 - leanX * 0.12));
      this.parallaxLeanY = Math.max(-1, Math.min(1, this.parallaxLeanY * 0.9 - leanY * 0.12));
    }

    this.particles.update(dt);
    this.draw();
    this.updateStats();

    for (const dolphin of this.dolphins) {
      dolphin.lastX = dolphin._x;
      dolphin.lastY = dolphin._y;
    }
    for (const shark of this.sharks) {
      shark.lastX = shark._x;
      shark.lastY = shark._y;
    }

    const speed = parseInt(this.speedInput.value, 10) || 80;
    this.timer = setTimeout(() => this.step(), speed);
  }

  private updateStats(): void {
    this.statTime.textContent = this.gameTime.toFixed(1) + 's';
    const spawnCount = Math.max(0, this.nextDolphinSpawnTime - this.gameTime);
    this.statSpawn.textContent = spawnCount.toFixed(1) + 's';
    this.statDolphins.textContent = String(this.dolphins.length);
    // The megamouth is not a shark and is not in the list, but it is the thing standing between
    // the pod and the end of the level - a HUD reading 0 while it circles would be a lie.
    this.statSharks.textContent = String(this.sharks.length + (this.megamouth ? 1 : 0));
    this.updateLastLifeHeart();
  }

  private updateLastLifeHeart(): void {
    if (!this.lastLifeHeart) return;
    if (this.getPodSize() <= 1) {
      const lives = 1 + this.vitalityLives;
      this.lastLifeHeart.textContent = '❤️'.repeat(lives);
      this.lastLifeHeart.classList.remove('hidden');
    } else {
      this.lastLifeHeart.classList.add('hidden');
      this.lastLifeHeart.textContent = '❤️';
    }
  }

  private draw(): void {
    const scale = WORLD_SCALE;
    const t = this.gameTime || 0;

    const now = Date.now();

    this.drawEchoRing(now, scale);

    for (const [dolphin, sprite] of this.dolphinSprites) {
      sprite.x = dolphin._x * scale + scale / 2;
      sprite.y = dolphin._y * scale + scale / 2;

      const fish = sprite.getChildByName('fish') as Container;
      const tail = fish.getChildByName('tail') as Container;

      const dx = directionDelta(dolphin._x, dolphin.lastX);
      const dy = dolphin._y - dolphin.lastY;
      const boosted = now < dolphin.speedBoostUntil;
      const fast = boosted || this.sprinting;

      // Whole-body swim: fluke beat, a counter-rotating body arch, a slow vertical bob,
      // a bank into vertical movement, and a forward stretch when moving fast.
      const beat = t * (fast ? 15 : 9) + dolphin.id * 1.7;
      tail.rotation = Math.sin(beat) * (fast ? 0.6 : 0.45);
      const stretch = fast ? 1.14 : 1;

      // Keep facing the last horizontal heading; only flip when genuinely swimming sideways.
      // The threshold is deliberately well above zero: a pod member easing into its formation
      // slot drifts by hundredths of a unit, and at 0.01 every one of those micro-corrections
      // mirrored the sprite. The dolphin flip-flopped on the spot, which read as shaking even
      // though its position was barely changing.
      const FLIP_THRESHOLD = 0.2;
      let dir = Math.sign(fish.scale.x) || 1;
      if (Math.abs(dx) > FLIP_THRESHOLD) dir = dx > 0 ? 1 : -1;
      fish.scale.set(dir * stretch, 1 / stretch);
      fish.rotation = Math.sin(beat - 0.8) * 0.05 + dir * Math.max(-1.4, Math.min(1.4, dy)) * 0.12;
      fish.y = Math.sin(t * 4.5 + dolphin.id) * 0.7;

      // A ghosted pod is drawn translucent, so the player can see the state they paid for
      // without the pod disappearing out from under them.
      sprite.alpha = now < this.ghostUntil ? GHOST_POD_ALPHA : 1;

      const invulnerable = now < dolphin.invulnerableUntil;
      const boostRing = sprite.getChildByName('boostRing') as Graphics;
      const invulRing = sprite.getChildByName('invulRing') as Graphics;

      boostRing.clear();
      if (boosted) {
        boostRing.circle(0, 0, 14).stroke({ width: 2, color: 0xfacc15, alpha: 1 });
      }

      invulRing.clear();
      if (invulnerable) {
        invulRing.circle(0, 0, 14).stroke({ width: 2, color: 0xa855f7, alpha: 1 });
      }

      if (dolphin.isPlayer) this.drawAbilityMeters(sprite);
    }

    for (const [shark, sprite] of this.sharkSprites) {
      sprite.x = shark._x * scale + scale / 2;
      sprite.y = shark._y * scale + scale / 2;

      const fish = sprite.getChildByName('fish') as Container;
      const look = SHARK_KIND_LOOK[shark.kind];
      const baseScale = SHARK_BASE_SCALE * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
      // The stretch rides on top of the facing sign, which is what reshapes a borrowed strip
      // into another species without touching the artwork.
      const scaleX = baseScale * look.stretchX;
      const scaleY = baseScale * look.stretchY;

      // Mid-strike a frilled shark faces the way it threw its head, so the picture and the bite
      // cannot point different ways - which they did while one followed the player and the other
      // followed the swimming heading.
      const dx =
        shark.reach > 0 && shark.reachDirX !== 0
          ? shark.reachDirX
          : this.player
            ? directionDelta(this.player._x, shark._x)
            : directionDelta(shark._x, shark.lastX);
      const facing = Math.abs(dx) > 0.3 ? (dx > 0 ? 1 : -1) : fish.scale.x >= 0 ? 1 : -1;

      // A frilled shark mid-strike is drawn longer by however far its head is out, and shifted
      // half that distance the way it is facing - stretching a sprite anchored at its middle
      // would otherwise throw as much tail backwards as head forwards, and the tail has not
      // moved. The bite reaches the same distance, from sharkBitePoint.
      const stretched = scaleX * (1 + FRILLED_REACH_FRACTION * shark.reach);
      fish.scale.set(stretched * facing, scaleY);
      const grownPx = (stretched - scaleX) * 64 * facing;
      fish.x = grownPx / 2;

      const lockTell = sprite.getChildByName('lockTell') as Graphics | null;
      if (lockTell) {
        // A ring that closes as the warning runs out, so the moment it commits is readable from
        // the water rather than only from the banner.
        lockTell.clear();
        const warning = shark.lockPhase === 'warning';
        lockTell.visible = warning;
        if (warning) {
          const left = Math.max(0, Math.min(1, (shark.lockPhaseEndTime - now) / LOCK_WARNING_MS));
          const radius = 10 + 26 * left;
          lockTell.circle(0, 0, radius).stroke({ width: 2, color: 0xf87171, alpha: 0.35 + 0.5 * (1 - left) });
        }
      }

      // Each light is placed in the artwork's own frame coordinates, so it stays on the belly
      // however the species has been reshaped, while the light itself keeps a near-constant size
      // on screen - a shark drawn small still has to be findable by its lights. They hold a low
      // glow and flare periodically, each shark seeded by its id so a shoal never flares in unison.
      // Both groups are siblings of the gloom rather than children of the shark, so each is
      // placed at the shark's own position here instead of inheriting it.
      const place = (
        group: Container | null,
        spots: { x: number; y: number }[] | undefined,
        dotScale: number,
      ): void => {
        if (!group || !spots) return;
        group.position.set(sprite.x, sprite.y);
        for (let i = 0; i < group.children.length; i++) {
          const dot = group.children[i];
          const spot = spots[i];
          if (!spot) continue;
          dot.position.set(spot.x * scaleX * facing, spot.y * scaleY);
          dot.scale.set(dotScale);
        }
      };

      const lights = this.sharkLights.get(sprite) ?? null;
      place(lights, look.photophores, shark.large ? PHOTOPHORE_DOT_ADULT : PHOTOPHORE_DOT_JUVENILE);
      // An adult blinks; a juvenile breathes. See photophoreFlashAlpha.
      if (lights) {
        lights.alpha = shark.large ? photophoreFlashAlpha(now, shark.id) : photophorePulseAlpha(now, shark.id);
      }

      // The eye keeps its own clock: no pulse, and nothing at all until the pod is close enough
      // to be looking at it.
      const eyes = this.sharkEyes.get(sprite) ?? null;
      // The eye keeps its own small size whatever the animal's - it is an eye, not an organ the
      // shark lights the water with.
      place(eyes, look.eyes, PHOTOPHORE_DOT_JUVENILE);
      if (eyes) eyes.alpha = this.sharkEyeAlpha(shark);

      if (fish instanceof SharkFishSprite) {
        const tell = this.sharkAttackTell(shark);
        const closeToDolphin = this.dolphins.some((d) => shark.distanceBetween(d) < tell);
        fish.setAttacking(closeToDolphin);
      }

      const reqText = sprite.getChildByName('reqText') as Text;
      if (reqText) {
        const req = this.sharkPodRequirement(shark.kind, shark.large);
        const canDestroy = this.getPodSize() >= req;
        // The bolt on large sharks flags that a Boost dash is also required, not just the pod.
        reqText.text = shark.large ? `⚡${req}` : String(req);
        reqText.style.fill = canDestroy ? '#22c55e' : '#ef4444';
        reqText.y = -40 * baseScale;
      }

      const glow = sprite.getChildByName('glow') as Sprite;
      glow.width = 48 * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;
      glow.height = 48 * SHARK_KIND_SCALE[shark.kind] * shark.sizeMultiplier;

      sprite.alpha = this.sharkAlphaWhileSafe(now);

      // Echolocation only ever reveals: a shark hidden by its cloak or by a storm is drawn while
      // it sits inside the ping, and a cloaked one stays ghosted so you can still tell it is
      // hiding rather than simply swimming at you.
      const revealed = this.sharkRevealedByEcho(shark);
      let bodySeen: boolean;
      if (shark.cloaked) {
        bodySeen = revealed;
        if (revealed) sprite.alpha = Math.min(sprite.alpha, 0.45);
      } else if (this.activeEvent?.type === 'storm' && this.player) {
        bodySeen = revealed || shark.distanceBetween(this.player) <= STORM_VISIBILITY_RADIUS;
      } else if (this.levelGloom > 0 && this.player) {
        // At depth a shark is only there if it is inside the pod's light or inside a ping.
        bodySeen = revealed || this.distanceToPlayer(shark) <= this.sharkSightRadius(shark);
      } else {
        bodySeen = true;
      }

      // A shark that carries its own lights is never lost once the body goes: at any distance it
      // is still a point of light on the move, anywhere in the water. What stays hidden is
      // everything that tells you what it is - the shape, and the pod size needed to ram it.
      //
      // The lights used to cut out past 1.7x the pod's sight, which meant a glowing shark simply
      // vanished at range rather than being tracked across the level - the one thing carrying
      // lights was meant to buy. Cloak still hides them: that is a deliberate mechanic, and a
      // light that survived it would leave nothing for cloaking to do.
      const lightsSeen = !!lights && this.levelGloom > 0 && !shark.cloaked;

      // A shark that has swum off for the kraken is drawn while it leaves and while it comes
      // back - watching them scatter is most of the point - but not while it is parked off the
      // edge, and its lights go with it rather than hanging in the water where it was.
      const offStage = shark.krakenFlight === 'gone';
      sprite.visible = bodySeen && !offStage;
      if (lights) lights.visible = (lightsSeen || bodySeen) && !offStage;
      fish.visible = bodySeen;
      glow.visible = bodySeen;
      if (reqText) reqText.visible = bodySeen;
    }

    this.drawJellyfish();
    this.drawKraken(now);

    this.stormOverlay.clear();
    if (this.activeEvent?.type === 'storm') {
      this.stormOverlay.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0x0b1225, alpha: 0.5 });
    }

    this.drawGloom(scale);
  }

  /**
   * The darkness at depth: a hole of light around the pod and black everywhere else, opened out to
   * the full reach of a ping while Echolocation is running. That widening is the point of the
   * whole thing - down here the ability is not a convenience, it is how you see.
   */
  private drawGloom(scale: number): void {
    if (this.levelGloom <= 0 || !this.player) {
      this.gloomOverlay.visible = false;
      return;
    }
    const lit = this.isEcholocating() ? this.echoRadius * GLOOM_ECHO_MARGIN : this.gloomSightRadius();
    // Sized from the clear middle of the texture outwards, which leaves the solid part far larger
    // than the canvas however close to an edge the pod swims.
    const span = (2 * lit * scale) / VIGNETTE_CLEAR_FRACTION;
    this.gloomOverlay.visible = true;
    this.gloomOverlay.width = span;
    this.gloomOverlay.height = span;
    this.gloomOverlay.alpha = this.levelGloom;
    this.gloomOverlay.position.set(this.player._x * scale + scale / 2, this.player._y * scale + scale / 2);
  }
}
