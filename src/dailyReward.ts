import { awardPearls } from './pearls';

const KEY = 'svsd-daily';

/**
 * Daily login rewards. Open the game on consecutive days and the payout climbs, peaking on the
 * seventh before starting over; miss a day and the streak goes back to the beginning.
 *
 * Deliberately has nothing to do with the Daily Challenge in the release plan. That needs a
 * seeded generator and a modifier system to vary; this needs a date and a counter, which is why
 * it can exist long before either of those.
 */

/** Payout for each day of a seven-day streak. Day seven is the reason to come back all week. */
export const DAILY_REWARDS = [20, 30, 40, 50, 60, 80, 150] as const;

export const STREAK_LENGTH = DAILY_REWARDS.length;

export interface DailyState {
  /** Local calendar day of the last claim, as YYYY-MM-DD. Empty when nothing was ever claimed. */
  lastClaimed: string;
  /** 1-based position in the streak, so 1 is the first day and 7 the payout day. 0 when unclaimed. */
  streak: number;
}

/**
 * The player's local calendar day. Local rather than UTC on purpose: "today" has to mean the day
 * the player is actually having, or someone west of Greenwich loses their streak at teatime.
 */
export function dayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days from one day key to another, ignoring clock time entirely. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

function empty(): DailyState {
  return { lastClaimed: '', streak: 0 };
}

function load(): DailyState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<DailyState>;
    const streak = Math.floor(Number(parsed.streak));
    return {
      lastClaimed: typeof parsed.lastClaimed === 'string' ? parsed.lastClaimed : '',
      streak: Number.isFinite(streak) ? Math.min(Math.max(streak, 0), STREAK_LENGTH) : 0,
    };
  } catch (e) {
    console.warn('Failed to load daily reward state', e);
    return empty();
  }
}

function save(state: DailyState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save daily reward state', e);
  }
}

export function getDailyState(): DailyState {
  return load();
}

/**
 * Which day of the streak a claim right now would land on, 1 to 7.
 *
 * Yesterday continues the streak; anything older starts it again. A last-claim date in the
 * future means the device clock moved backwards, which also starts again rather than locking
 * the player out until the date catches up.
 */
export function nextStreakDay(today: string = dayKey()): number {
  const { lastClaimed, streak } = load();
  if (!lastClaimed) return 1;
  const gap = daysBetween(lastClaimed, today);
  if (!Number.isFinite(gap) || gap < 0) return 1;
  if (gap === 1 && streak > 0 && streak < STREAK_LENGTH) return streak + 1;
  // A gap of 0 is today, already claimed - report what it was worth rather than nothing, so the
  // UI can show the day the player is on. Claiming again is refused by claimDailyReward.
  if (gap === 0 && streak > 0) return streak;
  return 1;
}

/** Pearls a claim would pay right now. */
export function pendingDailyReward(today: string = dayKey()): number {
  return DAILY_REWARDS[nextStreakDay(today) - 1];
}

/** True when today's reward has not been taken yet. */
export function dailyRewardAvailable(today: string = dayKey()): boolean {
  return load().lastClaimed !== today;
}

export interface DailyClaim {
  /** Pearls paid. 0 when the claim was refused because today's was already taken. */
  pearls: number;
  /** Day of the streak this claim landed on, 1 to 7. */
  day: number;
  claimed: boolean;
}

/**
 * Takes today's reward. Refuses, paying nothing, if it has already been claimed today - the only
 * guard that matters here, since the reward is free and the streak is the only thing at stake.
 */
export function claimDailyReward(today: string = dayKey()): DailyClaim {
  const state = load();
  if (state.lastClaimed === today) {
    return { pearls: 0, day: Math.max(1, state.streak), claimed: false };
  }
  const day = nextStreakDay(today);
  const pearls = DAILY_REWARDS[day - 1];
  save({ lastClaimed: today, streak: day });
  awardPearls(pearls);
  return { pearls, day, claimed: true };
}
