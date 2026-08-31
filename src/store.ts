import { spendPearls } from './pearls';
import { skinById } from './skins';

/**
 * The Store: Pearls (src/pearls.ts) are spent here on permanent Endless-mode
 * stat upgrades and dolphin skins. State persists in localStorage and is read
 * by game.ts (skin -> whole pod; upgrades -> Endless starting bonuses) and
 * rendered by src/storeView.ts.
 */

const KEY = 'svsd-store';

export type UpgradeId = 'vitality' | 'speed' | 'charisma' | 'boost' | 'boostDuration';

export interface UpgradeDef {
  name: string;
  desc: string;
  /** Pearl cost of each level; length is the max level. */
  prices: number[];
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  vitality: { name: 'Vitality', desc: '+1 starting life', prices: [60, 120, 220, 360, 550] },
  speed: { name: 'Speed', desc: '+5% swim speed', prices: [80, 150, 260, 400, 600] },
  charisma: { name: 'Charisma', desc: '+1 starting pod dolphin', prices: [100, 220, 400] },
  boost: { name: 'Boost Cooldown', desc: '-0.75s between boosts', prices: [90, 170, 300, 480] },
  boostDuration: { name: 'Boost Duration', desc: '+0.1s per boost', prices: [100, 200, 340, 520] },
};

const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export interface StoreState {
  upgrades: Record<UpgradeId, number>;
  ownedSkins: string[];
  equippedSkin: string;
}

function empty(): StoreState {
  return {
    upgrades: { vitality: 0, speed: 0, charisma: 0, boost: 0, boostDuration: 0 },
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
  };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    const base = empty();
    for (const id of UPGRADE_IDS) {
      const lvl = Math.floor(Number(parsed.upgrades?.[id]));
      base.upgrades[id] = Number.isFinite(lvl) ? Math.min(Math.max(lvl, 0), UPGRADES[id].prices.length) : 0;
    }
    if (Array.isArray(parsed.ownedSkins)) {
      base.ownedSkins = Array.from(new Set(['classic', ...parsed.ownedSkins.filter((s) => typeof s === 'string')]));
    }
    if (typeof parsed.equippedSkin === 'string' && base.ownedSkins.includes(parsed.equippedSkin)) {
      base.equippedSkin = parsed.equippedSkin;
    }
    return base;
  } catch (e) {
    console.warn('Failed to load store state', e);
    return empty();
  }
}

function save(state: StoreState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save store state', e);
  }
}

export function getStoreState(): StoreState {
  return load();
}

export function upgradeLevel(id: UpgradeId): number {
  return load().upgrades[id];
}

/** Pearl cost of the next level of `id`, or null if it is already maxed. */
export function nextUpgradeCost(id: UpgradeId): number | null {
  const lvl = load().upgrades[id];
  return lvl >= UPGRADES[id].prices.length ? null : UPGRADES[id].prices[lvl];
}

/** Buys the next level of `id` if it is affordable and not maxed. */
export function buyUpgrade(id: UpgradeId): boolean {
  const cost = nextUpgradeCost(id);
  if (cost === null || !spendPearls(cost)) return false;
  const state = load();
  state.upgrades[id] += 1;
  save(state);
  return true;
}

export function ownsSkin(id: string): boolean {
  return load().ownedSkins.includes(id);
}

/** Buys a skin (no-op if already owned or unaffordable). */
export function buySkin(id: string): boolean {
  const skin = skinById(id);
  if (skin.id !== id) return false;
  const state = load();
  if (state.ownedSkins.includes(id)) return false;
  if (!spendPearls(skin.price)) return false;
  state.ownedSkins.push(id);
  save(state);
  return true;
}

/** Equips an owned skin. */
export function equipSkin(id: string): boolean {
  const state = load();
  if (!state.ownedSkins.includes(id)) return false;
  state.equippedSkin = id;
  save(state);
  return true;
}

export function equippedSkinId(): string {
  return load().equippedSkin;
}

/** Endless-run starting bonuses from the purchased upgrade levels. Stacks with in-run Mega Shrimp picks. */
export function endlessStartBonuses(): {
  vitalityLives: number;
  speedBonusPct: number;
  charismaBonusDolphins: number;
  sprintCooldownReduction: number;
  sprintDurationBonus: number;
} {
  const s = load().upgrades;
  return {
    vitalityLives: s.vitality,
    speedBonusPct: s.speed * 0.05,
    charismaBonusDolphins: s.charisma,
    sprintCooldownReduction: s.boost * 750,
    sprintDurationBonus: s.boostDuration * 100,
  };
}
