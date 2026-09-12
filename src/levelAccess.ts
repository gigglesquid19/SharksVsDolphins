import { spendPearls } from './pearls';
import { ENDLESS_BACKGROUND_COUNT } from './levels';

const KEY = 'svsd-depth-access';

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
 * Pearls to unlock a starting depth. Climbs with the level, so skipping the whole descent costs
 * more than a full descent pays - a player who wants the Hadal is meant to reach it first and
 * buy the shortcut afterwards, not instead.
 */
export function levelAccessPrice(level: number): number {
  const depth = Math.floor(level);
  if (!Number.isFinite(depth) || depth <= FREE_START_LEVEL) return 0;
  return BASE_PRICE + (depth - FREE_START_LEVEL - 1) * PRICE_PER_LEVEL;
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

/** Whether a run may begin at this level. */
export function hasLevelAccess(level: number): boolean {
  const depth = Math.floor(level);
  if (depth === FREE_START_LEVEL) return true;
  return load().includes(depth);
}

/** Buys a starting depth. Fails, spending nothing, if it is out of range, owned, or unaffordable. */
export function buyLevelAccess(level: number): boolean {
  const depth = Math.floor(level);
  if (!Number.isFinite(depth) || depth <= FREE_START_LEVEL || depth > MAX_START_LEVEL) return false;
  if (hasLevelAccess(depth)) return false;
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
