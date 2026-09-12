import { getPearls } from './pearls';
import {
  ECHOLOCATION_PRICE,
  UPGRADES,
  UpgradeId,
  canBuyUpgrade,
  echolocationUnlocked,
  nextUpgradeCost,
  ownsEcholocation,
  upgradeLevel,
} from './store';
import { CONSUMABLES, freeConsumableSlots, totalConsumablesHeld } from './inventory';

/**
 * What to spend Pearls on next.
 *
 * A player looking at eleven purchasable things with no idea which matters is a player who buys
 * nothing, so the Store opens with one suggestion and a reason for it. The rules below are
 * ordered by what actually decides a run: an ability the player has earned but not taken, then
 * something to spend mid-run, then survivability, then breadth, then evening out whatever is
 * furthest behind.
 *
 * Only one is ever shown. A list of five recommendations is not a recommendation.
 */

export type RecommendationKind = 'ability' | 'consumable' | 'upgrade';

export interface Recommendation {
  kind: RecommendationKind;
  /** Upgrade id, consumable id, or 'echolocation'. */
  id: string;
  name: string;
  price: number;
  /** Why this one, in the player's own terms rather than the build's. */
  reason: string;
  affordable: boolean;
  /** Pearls still needed. 0 when affordable. */
  shortfall: number;
}

interface Candidate {
  kind: RecommendationKind;
  id: string;
  name: string;
  price: number;
  reason: string;
}

/** The upgrades that are worth anything before Echolocation itself is owned. */
function levelledUpgrades(): UpgradeId[] {
  return (Object.keys(UPGRADES) as UpgradeId[]).filter(
    (id) => canBuyUpgrade(id) && nextUpgradeCost(id) !== null,
  );
}

/**
 * The buyable upgrade furthest behind the rest, cheapest first on a tie. This is the fallback
 * once the pointed advice runs out, and it is what keeps a build from becoming three levels of
 * Speed and nothing else.
 */
function leastDeveloped(): Candidate | null {
  const ids = levelledUpgrades();
  if (ids.length === 0) return null;

  let best: UpgradeId | null = null;
  for (const id of ids) {
    if (best === null) {
      best = id;
      continue;
    }
    const level = upgradeLevel(id);
    const bestLevel = upgradeLevel(best);
    if (level < bestLevel) best = id;
    else if (level === bestLevel && (nextUpgradeCost(id) ?? 0) < (nextUpgradeCost(best) ?? 0)) best = id;
  }
  if (best === null) return null;

  const level = upgradeLevel(best);
  return {
    kind: 'upgrade',
    id: best,
    name: UPGRADES[best].name,
    price: nextUpgradeCost(best) ?? 0,
    reason:
      level === 0
        ? `${UPGRADES[best].name} is the one upgrade you have never touched.`
        : `${UPGRADES[best].name} is your least developed upgrade, at level ${level}.`,
  };
}

/** Every suggestion worth making right now, best first. */
function candidates(): Candidate[] {
  const list: Candidate[] = [];

  // An ability the player has earned and not claimed beats any amount of levelling.
  if (echolocationUnlocked() && !ownsEcholocation()) {
    list.push({
      kind: 'ability',
      id: 'echolocation',
      name: 'Echolocation',
      price: ECHOLOCATION_PRICE,
      reason: 'You cleared the campaign, so this is unlocked. It finds sharks through a storm and through a tiger shark’s cloak.',
    });
  }

  // Nothing to spend mid-run is the worst place to be: upgrades only set a run up, shrimp are
  // the only thing that can rescue one.
  if (totalConsumablesHeld() === 0) {
    list.push({
      kind: 'consumable',
      id: 'magicShrimp',
      name: CONSUMABLES.magicShrimp.name,
      price: CONSUMABLES.magicShrimp.price,
      reason: 'Your pack is empty. Shrimp are the only thing you can spend once a level has already turned against you.',
    });
  }

  if (upgradeLevel('vitality') === 0) {
    list.push({
      kind: 'upgrade',
      id: 'vitality',
      name: UPGRADES.vitality.name,
      price: nextUpgradeCost('vitality') ?? 0,
      reason: 'An extra life buys you the mistake every run eventually contains. Everything else is worth less if a run ends early.',
    });
  }

  if (upgradeLevel('charisma') === 0) {
    list.push({
      kind: 'upgrade',
      id: 'charisma',
      name: UPGRADES.charisma.name,
      price: nextUpgradeCost('charisma') ?? 0,
      reason: 'You start a Depthless run alone. A dolphin to begin with means Hunting Mode arrives levels sooner.',
    });
  }

  // Owned but never levelled: the ability cost 200 Pearls and is doing the least it ever will.
  if (ownsEcholocation() && upgradeLevel('echoDuration') === 0 && upgradeLevel('echoRadius') === 0) {
    list.push({
      kind: 'upgrade',
      id: 'echoDuration',
      name: UPGRADES.echoDuration.name,
      price: nextUpgradeCost('echoDuration') ?? 0,
      reason: 'You own Echolocation but have never upgraded it. Four seconds of vision is the least it will ever do.',
    });
  }

  const least = leastDeveloped();
  if (least) list.push(least);

  // Last of all: top the pack up. Useful, never urgent.
  if (freeConsumableSlots() > 0 && totalConsumablesHeld() > 0) {
    list.push({
      kind: 'consumable',
      id: 'magicShrimp',
      name: CONSUMABLES.magicShrimp.name,
      price: CONSUMABLES.magicShrimp.price,
      reason: `You have ${freeConsumableSlots()} free slot${freeConsumableSlots() === 1 ? '' : 's'} in your pack. They cost nothing to carry.`,
    });
  }

  return list;
}

/**
 * The single thing to buy next, or null when there is genuinely nothing to suggest.
 *
 * Prefers something the player can afford today - advice they can act on beats advice they can
 * only save towards. When nothing is affordable it still names the best target and says how far
 * off it is, which is more use than silence.
 */
export function recommendPurchase(): Recommendation | null {
  const list = candidates();
  if (list.length === 0) return null;

  const balance = getPearls();
  const affordable = list.find((c) => c.price <= balance);
  const chosen = affordable ?? list[0];

  return {
    kind: chosen.kind,
    id: chosen.id,
    name: chosen.name,
    price: chosen.price,
    reason: chosen.reason,
    affordable: chosen.price <= balance,
    shortfall: Math.max(0, chosen.price - balance),
  };
}
