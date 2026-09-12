import { beforeEach, describe, expect, it } from 'vitest';
import { getPearls } from './pearls';
import {
  DAILY_REWARDS,
  STREAK_LENGTH,
  claimDailyReward,
  dailyRewardAvailable,
  dayKey,
  getDailyState,
  nextStreakDay,
  pendingDailyReward,
} from './dailyReward';

beforeEach(() => {
  localStorage.clear();
});

/** Claims across a run of consecutive days, returning the day numbers it landed on. */
function claimDays(days: string[]): number[] {
  return days.map((d) => claimDailyReward(d).day);
}

describe('dayKey', () => {
  it('is the local calendar day, not UTC', () => {
    // 23:30 on the 5th local time is still the 5th, whatever UTC thinks.
    const late = new Date(2026, 8, 5, 23, 30);
    expect(dayKey(late)).toBe('2026-09-05');
  });

  it('pads months and days', () => {
    expect(dayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('a fresh player', () => {
  it('has a reward waiting on day one', () => {
    expect(getDailyState()).toEqual({ lastClaimed: '', streak: 0 });
    expect(dailyRewardAvailable('2026-09-12')).toBe(true);
    expect(nextStreakDay('2026-09-12')).toBe(1);
    expect(pendingDailyReward('2026-09-12')).toBe(DAILY_REWARDS[0]);
  });

  it('pays the day-one reward and records the streak', () => {
    const claim = claimDailyReward('2026-09-12');
    expect(claim).toEqual({ pearls: DAILY_REWARDS[0], day: 1, claimed: true });
    expect(getPearls()).toBe(DAILY_REWARDS[0]);
    expect(getDailyState()).toEqual({ lastClaimed: '2026-09-12', streak: 1 });
  });
});

describe('claiming', () => {
  it('refuses a second claim on the same day, paying nothing', () => {
    claimDailyReward('2026-09-12');
    const before = getPearls();
    const again = claimDailyReward('2026-09-12');
    expect(again.claimed).toBe(false);
    expect(again.pearls).toBe(0);
    expect(getPearls()).toBe(before);
    expect(dailyRewardAvailable('2026-09-12')).toBe(false);
  });

  it('climbs through the week on consecutive days', () => {
    const week = ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
    expect(claimDays(week)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPearls()).toBe(DAILY_REWARDS.reduce((a, b) => a + b, 0));
  });

  it('starts the week again the day after the payout day', () => {
    const week = ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
    claimDays(week);
    expect(claimDailyReward('2026-09-19').day).toBe(1);
  });

  it('resets the streak when a day is missed', () => {
    claimDays(['2026-09-12', '2026-09-13', '2026-09-14']);
    // nothing on the 15th
    const afterGap = claimDailyReward('2026-09-16');
    expect(afterGap.day).toBe(1);
    expect(afterGap.pearls).toBe(DAILY_REWARDS[0]);
  });

  it('carries a streak across a month boundary', () => {
    expect(claimDays(['2026-09-30', '2026-10-01'])).toEqual([1, 2]);
  });

  it('carries a streak across a year boundary', () => {
    expect(claimDays(['2026-12-31', '2027-01-01'])).toEqual([1, 2]);
  });
});

describe('a clock that cannot be trusted', () => {
  it('starts the streak again if the device date moves backwards', () => {
    claimDays(['2026-09-12', '2026-09-13']);
    // The player winds the clock back. They get a reward, but only the day-one one.
    const back = claimDailyReward('2026-09-01');
    expect(back.day).toBe(1);
    expect(back.pearls).toBe(DAILY_REWARDS[0]);
  });

  it('does not let a wound-back clock re-claim a day already taken', () => {
    claimDailyReward('2026-09-12');
    expect(claimDailyReward('2026-09-12').claimed).toBe(false);
  });
});

describe('storage', () => {
  it('recovers from corrupt state as a fresh player', () => {
    localStorage.setItem('svsd-daily', 'not json');
    expect(getDailyState()).toEqual({ lastClaimed: '', streak: 0 });
    expect(nextStreakDay('2026-09-12')).toBe(1);
  });

  it('clamps a tampered streak into the week', () => {
    localStorage.setItem('svsd-daily', JSON.stringify({ lastClaimed: '2026-09-12', streak: 999 }));
    expect(getDailyState().streak).toBe(STREAK_LENGTH);
    // At the end of the week, the next day starts over rather than paying beyond the table.
    expect(nextStreakDay('2026-09-13')).toBe(1);
  });

  it('never offers a reward outside the table', () => {
    for (let day = 1; day <= STREAK_LENGTH; day++) {
      expect(DAILY_REWARDS[day - 1]).toBeGreaterThan(0);
    }
    expect(DAILY_REWARDS).toHaveLength(STREAK_LENGTH);
  });
});
