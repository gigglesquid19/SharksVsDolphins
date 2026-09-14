import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls } from './pearls';
import { markCampaignCleared, markLevelCleared } from './progress';
import { IRON_SKIN_PRICE, IRON_SKIN_UNLOCK_LEVEL, buyIronSkin } from './store';
import {
  FIRST_CRUSHING_LEVEL,
  FIRST_DARK_LEVEL,
  FREE_START_LEVEL,
  MAX_START_LEVEL,
  buyLevelAccess,
  canBuyDarkDepths,
  canDiveBelowTheCrush,
  depthNeedsEcholocation,
  depthNeedsIronSkin,
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

/** Opens the dark depths for purchase: they need Echolocation on the Store's shelf first. */
function clearTheCampaign(): void {
  markCampaignCleared();
}

/**
 * Opens everything: the dark depths need the campaign cleared, and the depths below the
 * Bathypelagic need Iron Skin, which needs level 30 cleared and paying for.
 */
function openTheWholeOcean(): void {
  markCampaignCleared();
  markLevelCleared(IRON_SKIN_UNLOCK_LEVEL);
  awardPearls(IRON_SKIN_PRICE);
  buyIronSkin();
}

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
    clearTheCampaign();
    awardPearls(10_000);
    const before = getPearls();
    expect(buyLevelAccess(21)).toBe(true);
    expect(hasLevelAccess(21)).toBe(true);
    expect(getPearls()).toBe(before - levelAccessPrice(21));
  });

  it('refuses when the Pearls are short, spending nothing', () => {
    clearTheCampaign();
    awardPearls(levelAccessPrice(21) - 1);
    const before = getPearls();
    expect(buyLevelAccess(21)).toBe(false);
    expect(hasLevelAccess(21)).toBe(false);
    expect(getPearls()).toBe(before);
  });

  it('will not sell the same level twice', () => {
    clearTheCampaign();
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
    openTheWholeOcean();
    awardPearls(1_000_000);
    buyLevelAccess(31);
    buyLevelAccess(11);
    buyLevelAccess(21);
    expect(purchasedStartLevels()).toEqual([11, 21, 31]);
  });

  it('unlocks one level without unlocking its neighbours', () => {
    clearTheCampaign();
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

describe('the dark depths', () => {
  it('names level 11 down as the depths that need Echolocation', () => {
    expect(depthNeedsEcholocation(FIRST_DARK_LEVEL - 1)).toBe(false);
    expect(depthNeedsEcholocation(FIRST_DARK_LEVEL)).toBe(true);
    expect(depthNeedsEcholocation(MAX_START_LEVEL)).toBe(true);
  });

  it('will not sell one until Echolocation is on the shelf, and spends nothing trying', () => {
    awardPearls(1_000_000);
    const before = getPearls();
    expect(canBuyDarkDepths()).toBe(false);
    expect(buyLevelAccess(FIRST_DARK_LEVEL)).toBe(false);
    expect(hasLevelAccess(FIRST_DARK_LEVEL)).toBe(false);
    expect(getPearls()).toBe(before);
  });

  it('still sells the depths above it while the campaign is unbeaten', () => {
    awardPearls(1_000_000);
    expect(buyLevelAccess(FIRST_DARK_LEVEL - 1)).toBe(true);
    expect(hasLevelAccess(FIRST_DARK_LEVEL - 1)).toBe(true);
  });

  it('opens them once the campaign is cleared', () => {
    clearTheCampaign();
    awardPearls(1_000_000);
    expect(canBuyDarkDepths()).toBe(true);
    expect(buyLevelAccess(FIRST_DARK_LEVEL)).toBe(true);
    expect(hasLevelAccess(FIRST_DARK_LEVEL)).toBe(true);
  });

  it('charges a step up at the first dark depth, for the ability the dive is lent', () => {
    const lastLit = levelAccessPrice(FIRST_DARK_LEVEL - 1);
    const firstDark = levelAccessPrice(FIRST_DARK_LEVEL);
    // One level deeper, but far more than one level's worth of Pearls.
    expect(firstDark).toBeGreaterThan(lastLit * 1.5);
    expect(lastLit).toBe(250);
    expect(firstDark).toBe(475);
  });

  it('keeps climbing level by level below the step', () => {
    for (let depth = FIRST_DARK_LEVEL + 1; depth <= FIRST_DARK_LEVEL + 5; depth++) {
      expect(levelAccessPrice(depth)).toBeGreaterThan(levelAccessPrice(depth - 1));
    }
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
    clearTheCampaign();
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

describe('the crush below the Bathypelagic', () => {
  it('names every depth past level 30, and none above it', () => {
    expect(depthNeedsIronSkin(FIRST_CRUSHING_LEVEL)).toBe(true);
    expect(depthNeedsIronSkin(FIRST_CRUSHING_LEVEL - 1)).toBe(false);
    expect(depthNeedsIronSkin(MAX_START_LEVEL)).toBe(true);
    expect(depthNeedsIronSkin(FIRST_DARK_LEVEL)).toBe(false);
  });

  it('will not sell one until Iron Skin is owned, however many Pearls are offered', () => {
    clearTheCampaign();
    awardPearls(1_000_000);
    expect(canDiveBelowTheCrush()).toBe(false);
    expect(buyLevelAccess(FIRST_CRUSHING_LEVEL)).toBe(false);
    expect(hasLevelAccess(FIRST_CRUSHING_LEVEL)).toBe(false);
  });

  it('spends nothing on a refused purchase', () => {
    clearTheCampaign();
    awardPearls(1_000_000);
    const before = getPearls();
    buyLevelAccess(FIRST_CRUSHING_LEVEL);
    expect(getPearls()).toBe(before);
  });

  it('sells one once Iron Skin is owned', () => {
    openTheWholeOcean();
    awardPearls(1_000_000);
    expect(canDiveBelowTheCrush()).toBe(true);
    expect(buyLevelAccess(FIRST_CRUSHING_LEVEL)).toBe(true);
    expect(hasLevelAccess(FIRST_CRUSHING_LEVEL)).toBe(true);
  });

  it('leaves the depths above it alone', () => {
    clearTheCampaign();
    awardPearls(1_000_000);
    // Dark, but well above the crush: Echolocation is the only thing this one ever needed.
    expect(buyLevelAccess(FIRST_CRUSHING_LEVEL - 1)).toBe(true);
  });
});
