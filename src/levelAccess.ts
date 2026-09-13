import { spendPearls } from './pearls';
import { ENDLESS_BACKGROUND_COUNT } from './levels';
import { ECHOLOCATION_PRICE, echolocationUnlocked } from './store';

const KEY = 'svsd-depth-access';
const TEST_UNLOCK_KEY = 'svsd-depth-test-unlock';

/**
 * Paid starting depths for the Depthless Campaign.
 *
 * Every run begins at level 1 unless the player has bought their way further down. Access is per
 * level and permanent once bought, so a player who has paid for level 31 can dive straight into
 * the Abyssopelagic whenever they like.
 *
 * The catch, and the reason this can exist at all without hollowing the mode out: a run that
 * starts below level 1 never reaches the leaderboard. The board stays a record of descents made
 * from the surface, and the purchase buys practice and variety rather than a rank.
 */

/** The deepest level that can be bought. Past this the Depthless Campaign repeats its zones. */
export const MAX_START_LEVEL = ENDLESS_BACKGROUND_COUNT;

/** Level 1 is where everyone starts, and is never for sale. */
export const FREE_START_LEVEL = 1;

const BASE_PRICE = 50;
const PRICE_PER_LEVEL = 25;

/**
 * The first dark depth. From here down the water needs Echolocation to be read at all, which is
 * why these depths are both dearer and gated - see levelAccessPrice and depthNeedsEcholocation.
 */
export const FIRST_DARK_LEVEL = 11;

/**
 * What a dark depth costs on top of its place in the curve: the price of Echolocation itself.
 *
 * A dive that starts down there is lent the ability if it has not been bought, so the depth is
 * carrying an ability as well as a starting point, and it should be paid for accordingly.
 * Pinned to ECHOLOCATION_PRICE rather than written as its own number so the two cannot drift.
 */
const DARK_DEPTH_SURCHARGE = ECHOLOCATION_PRICE;

/**
 * Pearls to unlock a starting depth. Climbs with the level, so skipping the whole descent costs
 * more than a full descent pays - a player who wants the Hadal is meant to reach it first and
 * buy the shortcut afterwards, not instead. From the first dark depth it also carries the
 * surcharge above, which is the step up from 250 at level 10 to 475 at level 11.
 */
export function levelAccessPrice(level: number): number {
  const depth = Math.floor(level);
  if (!Number.isFinite(depth) || depth <= FREE_START_LEVEL) return 0;
  const curve = BASE_PRICE + (depth - FREE_START_LEVEL - 1) * PRICE_PER_LEVEL;
  return depth >= FIRST_DARK_LEVEL ? curve + DARK_DEPTH_SURCHARGE : curve;
}

/**
 * Whether this depth is one that cannot be bought until Echolocation has been unlocked in the
 * Store - which is to say until the campaign has been cleared.
 *
 * Buying a depth is buying a shortcut into water you could otherwise have descended into, and
 * from level 11 that water is dark. Selling someone the dark before they have any means of seeing
 * in it sells them a level they cannot play, so these depths stay shut until the ability that
 * answers them is at least available to them.
 */
export function depthNeedsEcholocation(level: number): boolean {
  return Math.floor(level) >= FIRST_DARK_LEVEL;
}

/** Whether the player has met that requirement yet. */
export function canBuyDarkDepths(): boolean {
  return echolocationUnlocked();
}

function load(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const levels = parsed
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isFinite(n) && n > FREE_START_LEVEL && n <= MAX_START_LEVEL);
    return [...new Set(levels)].sort((a, b) => a - b);
  } catch (e) {
    console.warn('Failed to load depth access', e);
    return [];
  }
}

function save(levels: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(levels));
  } catch (e) {
    console.warn('Failed to save depth access', e);
  }
}

/** Every level the player has bought, ascending. Never includes level 1, which is always free. */
export function purchasedStartLevels(): number[] {
  return load();
}

/**
 * Testing shortcut: opens every depth without spending anything, for the developer and early
 * testers who need to reach level 41 without playing forty levels to get there.
 *
 * Held as its own flag rather than by writing all fifty into the purchased list, so turning it
 * off restores exactly the levels the player actually bought and nothing is ever lost. It does
 * not touch the leaderboard rule: a dive from a test-unlocked depth is as unranked as a dive
 * from a bought one, because that rule keys off where the run started, not how it was opened.
 */
export function testUnlockAllActive(): boolean {
  try {
    return localStorage.getItem(TEST_UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Turns the testing shortcut on or off, leaving real purchases untouched either way. */
export function setTestUnlockAll(on: boolean): void {
  try {
    if (on) localStorage.setItem(TEST_UNLOCK_KEY, 'true');
    else localStorage.removeItem(TEST_UNLOCK_KEY);
  } catch (e) {
    console.warn('Failed to set the test unlock', e);
  }
}

/** Whether a run may begin at this level. */
export function hasLevelAccess(level: number): boolean {
  const depth = Math.floor(level);
  if (depth === FREE_START_LEVEL) return true;
  if (depth < FREE_START_LEVEL || depth > MAX_START_LEVEL) return false;
  if (testUnlockAllActive()) return true;
  return load().includes(depth);
}

/** Buys a starting depth. Fails, spending nothing, if it is out of range, owned, or unaffordable. */
export function buyLevelAccess(level: number): boolean {
  const depth = Math.floor(level);
  if (!Number.isFinite(depth) || depth <= FREE_START_LEVEL || depth > MAX_START_LEVEL) return false;
  if (hasLevelAccess(depth)) return false;
  // Shut, and not merely unaffordable, until Echolocation is on the shelf.
  if (depthNeedsEcholocation(depth) && !canBuyDarkDepths()) return false;
  if (!spendPearls(levelAccessPrice(depth))) return false;
  const levels = load();
  levels.push(depth);
  save([...new Set(levels)].sort((a, b) => a - b));
  return true;
}

/**
 * Whether a Depthless run that began at this level may post a score.
 *
 * The single rule the whole feature rests on, kept here rather than in the game loop so it reads
 * the same way from the level select, the run summary and any test.
 */
export function startLevelIsRanked(startLevel: number): boolean {
  return Math.floor(startLevel) <= FREE_START_LEVEL;
}
