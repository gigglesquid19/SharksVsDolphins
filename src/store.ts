import { spendPearls } from './pearls';
import { hasClearedCampaign } from './progress';
import { skinById } from './skins';

/**
 * The Store: Pearls (src/pearls.ts) are spent here on permanent Endless-mode
 * stat upgrades and dolphin skins. State persists in localStorage and is read
 * by game.ts (skin -> whole pod; upgrades -> Endless starting bonuses) and
 * rendered by src/storeView.ts.
 */

const KEY = 'svsd-store';

export type UpgradeId =
  | 'vitality'
  | 'speed'
  | 'charisma'
  | 'boost'
  | 'boostDuration'
  | 'echoDuration'
  | 'echoRadius';

/**
 * Echolocation: a one-off purchase rather than a levelled upgrade, locked until the campaign has
 * been cleared, and usable only in Endless. Its two upgrades are levelled like the rest but are
 * not buyable until the ability itself is owned - see canBuyUpgrade.
 */
export const ECHOLOCATION_ID = 'echolocation';
export const ECHOLOCATION_PRICE = 200;

export interface UpgradeDef {
  name: string;
  desc: string;
  /** Pearl cost of each level; length is the max level. */
  prices: number[];
}

/**
 * Every upgrade runs to six levels, and the Store is now the only place a Depthless dolphin gets
 * stronger - the Mega Shrimp pick after each level is a Campaign thing. That makes the ceiling
 * here the ceiling on a build, so they all share one, rather than Charisma stopping at three
 * while Vitality ran to five for no reason a player could see.
 *
 * Prices climb steeply at the top end because the last level of anything should be a decision
 * about a whole evening's Pearls rather than the next thing you happen to afford.
 */
export const MAX_UPGRADE_LEVEL = 6;

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  vitality: { name: 'Vitality', desc: '+1 starting life', prices: [60, 120, 220, 360, 550, 800] },
  speed: { name: 'Speed', desc: '+5% swim speed', prices: [80, 150, 260, 400, 600, 860] },
  charisma: { name: 'Charisma', desc: '+1 starting pod dolphin', prices: [100, 220, 400, 640, 950, 1350] },
  boost: { name: 'Boost Cooldown', desc: '-0.75s between boosts', prices: [90, 170, 300, 480, 720, 1030] },
  boostDuration: { name: 'Boost Duration', desc: '+0.1s per boost', prices: [100, 200, 340, 520, 760, 1080] },
  echoDuration: { name: 'Echo Duration', desc: '+1.5s of vision', prices: [120, 220, 360, 540, 780, 1090] },
  echoRadius: { name: 'Echo Range', desc: '+6 units of vision', prices: [120, 220, 360, 540, 780, 1090] },
};

/** Upgrades that only make sense once Echolocation has been bought. */
const ECHO_UPGRADES: UpgradeId[] = ['echoDuration', 'echoRadius'];

const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export interface StoreState {
  upgrades: Record<UpgradeId, number>;
  ownedSkins: string[];
  equippedSkin: string;
  /** One-off abilities bought outright, rather than levelled. Currently just Echolocation. */
  ownedAbilities: string[];
}

function empty(): StoreState {
  return {
    upgrades: { vitality: 0, speed: 0, charisma: 0, boost: 0, boostDuration: 0, echoDuration: 0, echoRadius: 0 },
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
    ownedAbilities: [],
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
    if (Array.isArray(parsed.ownedAbilities)) {
      base.ownedAbilities = parsed.ownedAbilities.filter((a) => typeof a === 'string');
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
  if (ECHO_UPGRADES.includes(id) && !ownsEcholocation()) return false;
  const cost = nextUpgradeCost(id);
  if (cost === null || !spendPearls(cost)) return false;
  const state = load();
  state.upgrades[id] += 1;
  save(state);
  return true;
}

export function ownsEcholocation(): boolean {
  return load().ownedAbilities.includes(ECHOLOCATION_ID);
}

/** Echolocation is the reward for finishing the campaign; Pearls alone are not enough. */
export function echolocationUnlocked(): boolean {
  return hasClearedCampaign();
}

/** Buys Echolocation. Fails if the campaign is unbeaten, it is already owned, or Pearls are short. */
export function buyEcholocation(): boolean {
  if (!echolocationUnlocked() || ownsEcholocation()) return false;
  if (!spendPearls(ECHOLOCATION_PRICE)) return false;
  const state = load();
  state.ownedAbilities.push(ECHOLOCATION_ID);
  save(state);
  return true;
}

/** Whether an upgrade may be bought at all, ignoring price - Echo upgrades need the ability first. */
export function canBuyUpgrade(id: UpgradeId): boolean {
  if (ECHO_UPGRADES.includes(id) && !ownsEcholocation()) return false;
  return nextUpgradeCost(id) !== null;
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

/** Adds a skin to the collection with no Pearl cost (e.g. a share reward). No-op if already owned. */
export function grantSkin(id: string): boolean {
  const skin = skinById(id);
  if (skin.id !== id) return false;
  const state = load();
  if (state.ownedSkins.includes(id)) return false;
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

/** Base Echolocation numbers before upgrades. Cooldown is deliberately not upgradeable: it is
 *  what stops the ability becoming permanent vision once duration is maxed. */
export const ECHO_BASE_DURATION_MS = 4000;
export const ECHO_DURATION_PER_LEVEL_MS = 1500;
export const ECHO_BASE_RADIUS = 24;
export const ECHO_RADIUS_PER_LEVEL = 6;
export const ECHO_COOLDOWN_MS = 18000;

/** Echolocation duration and radius at the levels currently bought. */
export function echolocationStats(): { durationMs: number; radius: number; cooldownMs: number } {
  const s = load().upgrades;
  return {
    durationMs: ECHO_BASE_DURATION_MS + s.echoDuration * ECHO_DURATION_PER_LEVEL_MS,
    radius: ECHO_BASE_RADIUS + s.echoRadius * ECHO_RADIUS_PER_LEVEL,
    cooldownMs: ECHO_COOLDOWN_MS,
  };
}

/** Depthless starting bonuses from the purchased upgrade levels - the whole of a Depthless build. */
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
