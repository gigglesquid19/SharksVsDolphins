import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls } from './pearls';
import {
  FREE_START_LEVEL,
  MAX_START_LEVEL,
  buyLevelAccess,
  hasLevelAccess,
  levelAccessPrice,
  purchasedStartLevels,
  setTestUnlockAll,
  startLevelIsRanked,
  testUnlockAllActive,
} from './levelAccess';

beforeEach(() => {
  localStorage.clear();
});

describe('pricing', () => {
  it('is free to start where everyone starts', () => {
    expect(levelAccessPrice(FREE_START_LEVEL)).toBe(0);
    expect(hasLevelAccess(FREE_START_LEVEL)).toBe(true);
  });

  it('costs more the deeper the start', () => {
    expect(levelAccessPrice(2)).toBeLessThan(levelAccessPrice(11));
    expect(levelAccessPrice(11)).toBeLessThan(levelAccessPrice(41));
  });

  it('asks more for the whole descent than a descent pays out', () => {
    // A full run to level 50 pays 1000 Pearls in zone bonuses, so buying past it must cost more
    // or the shortcut becomes the efficient way to play.
    expect(levelAccessPrice(MAX_START_LEVEL)).toBeGreaterThan(1000);
  });
});

describe('buying', () => {
  it('unlocks a level and spends the price', () => {
    awardPearls(10_000);
    const before = getPearls();
    expect(buyLevelAccess(21)).toBe(true);
    expect(hasLevelAccess(21)).toBe(true);
    expect(getPearls()).toBe(before - levelAccessPrice(21));
  });

  it('refuses when the Pearls are short, spending nothing', () => {
    awardPearls(levelAccessPrice(21) - 1);
    const before = getPearls();
    expect(buyLevelAccess(21)).toBe(false);
    expect(hasLevelAccess(21)).toBe(false);
    expect(getPearls()).toBe(before);
  });

  it('will not sell the same level twice', () => {
    awardPearls(100_000);
    expect(buyLevelAccess(11)).toBe(true);
    const after = getPearls();
    expect(buyLevelAccess(11)).toBe(false);
    expect(getPearls()).toBe(after);
  });

  it('will not sell level 1, which is already free', () => {
    awardPearls(10_000);
    expect(buyLevelAccess(1)).toBe(false);
    expect(purchasedStartLevels()).toEqual([]);
  });

  it('will not sell a level past the deepest zone', () => {
    awardPearls(1_000_000);
    expect(buyLevelAccess(MAX_START_LEVEL + 1)).toBe(false);
    expect(buyLevelAccess(999)).toBe(false);
  });

  it('keeps purchases sorted and unique', () => {
    awardPearls(1_000_000);
    buyLevelAccess(31);
    buyLevelAccess(11);
    buyLevelAccess(21);
    expect(purchasedStartLevels()).toEqual([11, 21, 31]);
  });

  it('unlocks one level without unlocking its neighbours', () => {
    awardPearls(100_000);
    buyLevelAccess(21);
    expect(hasLevelAccess(20)).toBe(false);
    expect(hasLevelAccess(22)).toBe(false);
  });
});

describe('the leaderboard rule', () => {
  it('ranks a run that started at the surface', () => {
    expect(startLevelIsRanked(FREE_START_LEVEL)).toBe(true);
  });

  it('never ranks a run that started deeper, bought or not', () => {
    expect(startLevelIsRanked(2)).toBe(false);
    expect(startLevelIsRanked(21)).toBe(false);
    expect(startLevelIsRanked(MAX_START_LEVEL)).toBe(false);
  });
});

describe('storage', () => {
  it('recovers from corrupt state with nothing unlocked', () => {
    localStorage.setItem('svsd-depth-access', 'not json');
    expect(purchasedStartLevels()).toEqual([]);
    expect(hasLevelAccess(21)).toBe(false);
  });

  it('discards tampered entries outside the valid range', () => {
    localStorage.setItem('svsd-depth-access', JSON.stringify([1, 21, 999, -4, 'x']));
    expect(purchasedStartLevels()).toEqual([21]);
  });
});

describe('the testing unlock', () => {
  it('is off until it is switched on', () => {
    expect(testUnlockAllActive()).toBe(false);
    expect(hasLevelAccess(41)).toBe(false);
  });

  it('opens every depth without spending anything', () => {
    awardPearls(100);
    const before = getPearls();
    setTestUnlockAll(true);
    for (const level of [2, 11, 21, 31, 41, MAX_START_LEVEL]) {
      expect(hasLevelAccess(level)).toBe(true);
    }
    expect(getPearls()).toBe(before);
  });

  it('leaves real purchases alone when switched off', () => {
    awardPearls(100_000);
    buyLevelAccess(21);
    setTestUnlockAll(true);
    expect(hasLevelAccess(41)).toBe(true);

    setTestUnlockAll(false);
    // The bought level survives; the borrowed ones do not.
    expect(purchasedStartLevels()).toEqual([21]);
    expect(hasLevelAccess(21)).toBe(true);
    expect(hasLevelAccess(41)).toBe(false);
  });

  it('does not record the opened levels as purchases', () => {
    setTestUnlockAll(true);
    expect(purchasedStartLevels()).toEqual([]);
  });

  it('does not make a deep dive rankable', () => {
    // The point of the rule is where the run STARTED, not how that depth was opened.
    setTestUnlockAll(true);
    expect(startLevelIsRanked(41)).toBe(false);
    expect(startLevelIsRanked(FREE_START_LEVEL)).toBe(true);
  });

  it('still refuses a level past the deepest zone', () => {
    setTestUnlockAll(true);
    expect(hasLevelAccess(MAX_START_LEVEL + 1)).toBe(false);
  });

  it('will not sell a level the testing unlock has already opened', () => {
    awardPearls(100_000);
    setTestUnlockAll(true);
    const before = getPearls();
    expect(buyLevelAccess(21)).toBe(false);
    expect(getPearls()).toBe(before);
  });
});
