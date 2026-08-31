import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls } from './pearls';
import {
  UPGRADES,
  buySkin,
  buyUpgrade,
  endlessStartBonuses,
  equipSkin,
  equippedSkinId,
  getStoreState,
  grantSkin,
  nextUpgradeCost,
  ownsSkin,
  upgradeLevel,
} from './store';

beforeEach(() => {
  localStorage.clear();
});

describe('default state', () => {
  it('owns only classic and has no upgrades', () => {
    const s = getStoreState();
    expect(s.ownedSkins).toEqual(['classic']);
    expect(s.equippedSkin).toBe('classic');
    expect(s.upgrades).toEqual({ vitality: 0, speed: 0, charisma: 0, boost: 0, boostDuration: 0 });
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
  it('buys and equips, but will not equip an unowned skin', () => {
    awardPearls(1000);
    expect(equipSkin('orca')).toBe(false);
    expect(buySkin('orca')).toBe(true);
    expect(ownsSkin('orca')).toBe(true);
    expect(buySkin('orca')).toBe(false); // already owned
    expect(equipSkin('orca')).toBe(true);
    expect(equippedSkinId()).toBe('orca');
  });

  it('will not buy a skin you cannot afford', () => {
    awardPearls(5);
    expect(buySkin('gold')).toBe(false);
    expect(ownsSkin('gold')).toBe(false);
  });

  it('grants a reward skin with no Pearl cost, and only once', () => {
    awardPearls(50);
    expect(grantSkin('voyager')).toBe(true);
    expect(ownsSkin('voyager')).toBe(true);
    expect(getPearls()).toBe(50);
    expect(grantSkin('voyager')).toBe(false); // already owned
  });

  it('will not sell the reward skin', () => {
    awardPearls(1000);
    expect(buySkin('voyager')).toBe(false);
    expect(ownsSkin('voyager')).toBe(false);
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
    expect(endlessStartBonuses()).toEqual({
      vitalityLives: 1,
      speedBonusPct: 0.1,
      charismaBonusDolphins: 0,
      sprintCooldownReduction: 750,
      sprintDurationBonus: 200,
    });
  });
});
