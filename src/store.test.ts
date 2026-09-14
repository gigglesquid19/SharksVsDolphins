import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls } from './pearls';
import { DOLPHIN_SKINS } from './skins';
import { SHARE_REWARD_SKIN } from './share';
import type { UpgradeId } from './store';
import {
  ECHOLOCATION_PRICE,
  MAX_UPGRADE_LEVEL,
  UPGRADES,
  buyEcholocation,
  buySkin,
  buyUpgrade,
  canBuyUpgrade,
  baseEcholocationStats,
  echolocationStats,
  developerModeActive,
  grantHalfUpgrades,
  halfUpgradeLevel,
  setDeveloperMode,
  echolocationUnlocked,
  endlessStartBonuses,
  equipSkin,
  equippedSkinId,
  getStoreState,
  grantSkin,
  nextUpgradeCost,
  ownsEcholocation,
  ownsSkin,
  upgradeLevel,
} from './store';
import { hasClearedCampaign, markCampaignCleared } from './progress';

beforeEach(() => {
  localStorage.clear();
});

describe('default state', () => {
  it('owns only classic and has no upgrades', () => {
    const s = getStoreState();
    expect(s.ownedSkins).toEqual(['classic']);
    expect(s.equippedSkin).toBe('classic');
    expect(s.upgrades).toEqual({
      vitality: 0,
      speed: 0,
      charisma: 0,
      boost: 0,
      boostDuration: 0,
      echoDuration: 0,
      echoRadius: 0,
      responsiveness: 0,
    });
    expect(s.ownedAbilities).toEqual([]);
  });

  it('recovers from corrupt storage', () => {
    localStorage.setItem('svsd-store', 'not json');
    expect(getStoreState().equippedSkin).toBe('classic');
  });
});

describe('buyUpgrade', () => {
  it('spends the listed price and bumps the level', () => {
    awardPearls(1000);
    expect(buyUpgrade('speed')).toBe(true);
    expect(upgradeLevel('speed')).toBe(1);
    expect(getPearls()).toBe(1000 - UPGRADES.speed.prices[0]);
    expect(nextUpgradeCost('speed')).toBe(UPGRADES.speed.prices[1]);
  });

  it('refuses when the balance is too low', () => {
    awardPearls(10);
    expect(buyUpgrade('speed')).toBe(false);
    expect(upgradeLevel('speed')).toBe(0);
    expect(getPearls()).toBe(10);
  });

  it('caps at the max level', () => {
    awardPearls(100000);
    for (let i = 0; i < UPGRADES.charisma.prices.length; i++) expect(buyUpgrade('charisma')).toBe(true);
    expect(buyUpgrade('charisma')).toBe(false);
    expect(nextUpgradeCost('charisma')).toBeNull();
    expect(upgradeLevel('charisma')).toBe(UPGRADES.charisma.prices.length);
  });
});

describe('skins', () => {
  // Taken from the catalogue rather than named, so moving a skin between the shelf and the
  // share reward does not break these - which is exactly what happened when Orca became the
  // share reward and this file still bought it.
  const SELLABLE = DOLPHIN_SKINS.find((s) => s.source === 'store' && s.price > 0)!.id;

  it('buys and equips, but will not equip an unowned skin', () => {
    awardPearls(1000);
    expect(equipSkin(SELLABLE)).toBe(false);
    expect(buySkin(SELLABLE)).toBe(true);
    expect(ownsSkin(SELLABLE)).toBe(true);
    expect(buySkin(SELLABLE)).toBe(false); // already owned
    expect(equipSkin(SELLABLE)).toBe(true);
    expect(equippedSkinId()).toBe(SELLABLE);
  });

  it('will not buy a skin you cannot afford', () => {
    awardPearls(5);
    expect(buySkin('gold')).toBe(false);
    expect(ownsSkin('gold')).toBe(false);
  });

  it('grants a reward skin with no Pearl cost, and only once', () => {
    awardPearls(50);
    expect(grantSkin(SHARE_REWARD_SKIN)).toBe(true);
    expect(ownsSkin(SHARE_REWARD_SKIN)).toBe(true);
    expect(getPearls()).toBe(50);
    expect(grantSkin(SHARE_REWARD_SKIN)).toBe(false); // already owned
  });

  it('will not sell the reward skin', () => {
    awardPearls(1000);
    expect(buySkin(SHARE_REWARD_SKIN)).toBe(false);
    expect(ownsSkin(SHARE_REWARD_SKIN)).toBe(false);
  });
});

describe('endlessStartBonuses', () => {
  it('derives from the purchased upgrade levels', () => {
    awardPearls(100000);
    buyUpgrade('vitality');
    buyUpgrade('speed');
    buyUpgrade('speed');
    buyUpgrade('boost');
    buyUpgrade('boostDuration');
    buyUpgrade('boostDuration');
    buyUpgrade('responsiveness');
    buyUpgrade('responsiveness');
    buyUpgrade('responsiveness');
    expect(endlessStartBonuses()).toEqual({
      vitalityLives: 1,
      speedBonusPct: 0.1,
      charismaBonusDolphins: 0,
      sprintCooldownReduction: 750,
      sprintDurationBonus: 200,
      responsiveness: 3,
    });
  });
});

describe('grantHalfUpgrades', () => {
  it('takes every upgrade to half the ceiling', () => {
    const half = halfUpgradeLevel();
    expect(half).toBe(MAX_UPGRADE_LEVEL / 2);
    grantHalfUpgrades();
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
      expect(upgradeLevel(id)).toBe(half);
    }
  });

  it('spends nothing', () => {
    const before = getPearls();
    grantHalfUpgrades();
    expect(getPearls()).toBe(before);
  });

  it('reports how many levels it handed over', () => {
    const ids = Object.keys(UPGRADES) as UpgradeId[];
    expect(grantHalfUpgrades()).toBe(ids.length * halfUpgradeLevel());
  });

  it('raises but never lowers, so a build past halfway is left alone', () => {
    markCampaignCleared();
    awardPearls(100_000);
    // Take one upgrade well past the halfway mark the cheat grants.
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) buyUpgrade('speed');
    expect(upgradeLevel('speed')).toBe(MAX_UPGRADE_LEVEL);

    grantHalfUpgrades();
    expect(upgradeLevel('speed')).toBe(MAX_UPGRADE_LEVEL);
    expect(upgradeLevel('vitality')).toBe(halfUpgradeLevel());
  });

  it('does nothing, and says so, when everything is already there', () => {
    grantHalfUpgrades();
    expect(grantHalfUpgrades()).toBe(0);
  });

  it('leaves Echolocation alone - it is a purchase, not a rung on the tree', () => {
    grantHalfUpgrades();
    expect(ownsEcholocation()).toBe(false);
  });
});

describe('developer mode', () => {
  it('is off until it is switched on', () => {
    expect(developerModeActive()).toBe(false);
  });

  it('switches on and back off', () => {
    setDeveloperMode(true);
    expect(developerModeActive()).toBe(true);
    setDeveloperMode(false);
    expect(developerModeActive()).toBe(false);
  });

  it('is kept outside the build, so clearing one does not switch the other', () => {
    setDeveloperMode(true);
    grantHalfUpgrades();
    // Wiping the store's own state leaves the testing flag where it was, and vice versa.
    localStorage.removeItem('svsd-store');
    expect(developerModeActive()).toBe(true);
    expect(upgradeLevel('speed')).toBe(0);
  });
});

describe('Echolocation', () => {
  it('stays locked until the campaign is cleared, however many Pearls you have', () => {
    awardPearls(10_000);
    expect(hasClearedCampaign()).toBe(false);
    expect(echolocationUnlocked()).toBe(false);
    expect(buyEcholocation()).toBe(false);
    expect(ownsEcholocation()).toBe(false);
    expect(getPearls()).toBe(10_000); // nothing was spent on the failed attempt
  });

  it('unlocks once the campaign is cleared and then costs Pearls', () => {
    markCampaignCleared();
    expect(echolocationUnlocked()).toBe(true);

    awardPearls(ECHOLOCATION_PRICE - 1);
    expect(buyEcholocation()).toBe(false); // unlocked, but not affordable

    awardPearls(1);
    expect(buyEcholocation()).toBe(true);
    expect(ownsEcholocation()).toBe(true);
    expect(getPearls()).toBe(0);
  });

  it('cannot be bought twice', () => {
    markCampaignCleared();
    awardPearls(ECHOLOCATION_PRICE * 2);
    expect(buyEcholocation()).toBe(true);
    expect(buyEcholocation()).toBe(false);
    expect(getPearls()).toBe(ECHOLOCATION_PRICE);
  });

  it('gates its upgrades behind owning the ability', () => {
    awardPearls(10_000);
    expect(canBuyUpgrade('echoDuration')).toBe(false);
    expect(buyUpgrade('echoDuration')).toBe(false);
    expect(upgradeLevel('echoDuration')).toBe(0);

    markCampaignCleared();
    buyEcholocation();
    expect(canBuyUpgrade('echoDuration')).toBe(true);
    expect(buyUpgrade('echoDuration')).toBe(true);
    expect(upgradeLevel('echoDuration')).toBe(1);
  });

  it('leaves the other upgrades ungated', () => {
    expect(canBuyUpgrade('speed')).toBe(true);
  });

  it('lends the unupgraded ability, whatever has been bought on top of it', () => {
    // What a dark depth hands a player who has not bought Echolocation. It must not move when
    // upgrades are bought, or someone who never paid for the ability would end up with a better
    // one than a player who paid and has not levelled it yet.
    const lentBefore = baseEcholocationStats();
    markCampaignCleared();
    awardPearls(10_000);
    buyEcholocation();
    buyUpgrade('echoDuration');
    buyUpgrade('echoRadius');

    expect(baseEcholocationStats()).toEqual(lentBefore);
    const upgraded = echolocationStats();
    expect(upgraded.durationMs).toBeGreaterThan(lentBefore.durationMs);
    expect(upgraded.radius).toBeGreaterThan(lentBefore.radius);
    // The one number the two share: lending does not hand out a shorter wait either.
    expect(baseEcholocationStats().cooldownMs).toBe(upgraded.cooldownMs);
  });

  it('grows duration and radius with the levels bought, leaving cooldown alone', () => {
    const base = echolocationStats();
    markCampaignCleared();
    awardPearls(10_000);
    buyEcholocation();
    buyUpgrade('echoDuration');
    buyUpgrade('echoRadius');
    const upgraded = echolocationStats();

    expect(upgraded.durationMs).toBeGreaterThan(base.durationMs);
    expect(upgraded.radius).toBeGreaterThan(base.radius);
    // Cooldown is deliberately fixed - it is what stops maxed duration becoming permanent vision.
    expect(upgraded.cooldownMs).toBe(base.cooldownMs);
  });

  it('cannot be pushed past its maximum level', () => {
    markCampaignCleared();
    awardPearls(100_000);
    buyEcholocation();
    const max = UPGRADES.echoRadius.prices.length;
    for (let i = 0; i < max; i++) expect(buyUpgrade('echoRadius')).toBe(true);
    expect(nextUpgradeCost('echoRadius')).toBeNull();
    expect(canBuyUpgrade('echoRadius')).toBe(false);
    expect(upgradeLevel('echoRadius')).toBe(max);
  });
});
