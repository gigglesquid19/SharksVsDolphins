import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls } from './pearls';
import { buyEcholocation, buyUpgrade, UPGRADES, UpgradeId, upgradeLevel } from './store';
import { buyConsumable } from './inventory';
import { markCampaignCleared } from './progress';
import { recommendPurchase } from './recommendation';

beforeEach(() => {
  localStorage.clear();
});

/** Levels an upgrade up `times` times, with the Pearls to do it. */
function level(id: UpgradeId, times: number): void {
  awardPearls(100_000);
  for (let i = 0; i < times; i++) expect(buyUpgrade(id)).toBe(true);
}

/** Takes every upgrade to its ceiling, so only the fallback rules are left. */
function maxEverything(): void {
  awardPearls(1_000_000);
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
    for (let i = 0; i < UPGRADES[id].prices.length; i++) buyUpgrade(id);
  }
}

describe('what to buy first', () => {
  it('sends a new player to Vitality before anything else', () => {
    awardPearls(1000);
    buyConsumable('magicShrimp'); // pack not empty, so that rule is out of the way
    const rec = recommendPurchase();
    expect(rec?.id).toBe('vitality');
    expect(rec?.kind).toBe('upgrade');
    expect(rec?.affordable).toBe(true);
  });

  it('puts an empty pack ahead of any upgrade', () => {
    awardPearls(1000);
    const rec = recommendPurchase();
    expect(rec?.kind).toBe('consumable');
    expect(rec?.reason).toMatch(/pack is empty/i);
  });

  it('puts an unclaimed Echolocation ahead of everything', () => {
    awardPearls(1000);
    markCampaignCleared();
    const rec = recommendPurchase();
    expect(rec?.kind).toBe('ability');
    expect(rec?.id).toBe('echolocation');
  });

  it('does not suggest Echolocation before the campaign is cleared', () => {
    awardPearls(1000);
    expect(recommendPurchase()?.id).not.toBe('echolocation');
  });

  it('stops suggesting Echolocation once it is owned', () => {
    awardPearls(10_000);
    markCampaignCleared();
    buyEcholocation();
    expect(recommendPurchase()?.id).not.toBe('echolocation');
  });
});

describe('once the basics are covered', () => {
  it('suggests Charisma when Vitality is levelled and the pod still starts alone', () => {
    awardPearls(10_000);
    buyConsumable('magicShrimp');
    level('vitality', 1);
    expect(recommendPurchase()?.id).toBe('charisma');
  });

  it('evens out the build by naming the least developed upgrade', () => {
    awardPearls(100_000);
    buyConsumable('magicShrimp');
    level('vitality', 2);
    level('charisma', 2);
    level('speed', 3);
    // boost, boostDuration are untouched and cheapest-first decides between them.
    const rec = recommendPurchase();
    expect(rec?.kind).toBe('upgrade');
    expect(upgradeLevel(rec?.id as UpgradeId)).toBe(0);
    expect(rec?.reason).toMatch(/never touched/i);
  });

  it('nudges an owned but unlevelled Echolocation', () => {
    awardPearls(100_000);
    buyConsumable('magicShrimp');
    markCampaignCleared();
    buyEcholocation();
    level('vitality', 1);
    level('charisma', 1);
    const rec = recommendPurchase();
    expect(rec?.id).toBe('echoDuration');
    expect(rec?.reason).toMatch(/never upgraded/i);
  });

  it('never suggests an Echo upgrade without the ability', () => {
    awardPearls(100_000);
    buyConsumable('magicShrimp');
    level('vitality', 3);
    level('charisma', 3);
    for (let i = 0; i < 20; i++) {
      const rec = recommendPurchase();
      if (!rec || rec.kind !== 'upgrade') break;
      expect(['echoDuration', 'echoRadius']).not.toContain(rec.id);
      buyUpgrade(rec.id as UpgradeId);
    }
  });

  it('offers to top up a part-filled pack only once nothing else is pressing', () => {
    awardPearls(1_000_000);
    buyConsumable('magicShrimp');
    maxEverything();
    const rec = recommendPurchase();
    expect(rec?.kind).toBe('consumable');
    expect(rec?.reason).toMatch(/free slot/i);
  });
});

describe('affordability', () => {
  it('prefers something the player can actually buy today', () => {
    // Enough for a shrimp, nowhere near Echolocation.
    awardPearls(60);
    markCampaignCleared();
    const rec = recommendPurchase();
    expect(rec?.affordable).toBe(true);
    expect(rec?.kind).toBe('consumable');
  });

  it('still names the best target when nothing is affordable, with the shortfall', () => {
    awardPearls(5);
    markCampaignCleared();
    const rec = recommendPurchase();
    expect(rec?.id).toBe('echolocation');
    expect(rec?.affordable).toBe(false);
    expect(rec?.shortfall).toBe(200 - 5);
  });

  it('reports no shortfall on an affordable suggestion', () => {
    awardPearls(10_000);
    expect(recommendPurchase()?.shortfall).toBe(0);
  });
});

describe('nothing left to suggest', () => {
  it('returns null once everything is maxed and the pack is full', () => {
    awardPearls(1_000_000);
    markCampaignCleared();
    buyEcholocation();
    maxEverything();
    for (let i = 0; i < 3; i++) buyConsumable('magicShrimp');
    expect(recommendPurchase()).toBeNull();
  });
});
