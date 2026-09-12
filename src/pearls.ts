const KEY = 'svsd-pearls';

/**
 * Pearls are a soft currency that persists on the device across playthroughs.
 * They are earned by completing a level (any mode) and by clearing the campaign,
 * and spent in the Store (src/store.ts) on Endless upgrades and dolphin skins.
 */

function load(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    console.warn('Failed to load pearls', e);
    return 0;
  }
}

function save(total: number): void {
  try {
    localStorage.setItem(KEY, String(total));
  } catch (e) {
    console.warn('Failed to save pearls', e);
  }
}

/** The player's current Pearl balance (0 if never earned or storage is unreadable). */
export function getPearls(): number {
  return load();
}

/** Adds `n` Pearls (non-positive amounts are ignored) and returns the new balance. */
export function awardPearls(n: number): number {
  const add = Math.floor(n);
  if (!Number.isFinite(add) || add <= 0) return load();
  const total = load() + add;
  save(total);
  return total;
}

/** Deducts `n` Pearls if the balance covers it; returns true on success, false (no change) otherwise. */
export function spendPearls(n: number): boolean {
  const cost = Math.floor(n);
  if (!Number.isFinite(cost) || cost <= 0) return false;
  const total = load();
  if (total < cost) return false;
  save(total - cost);
  return true;
}

/** Base per-level payout: grows with depth, with a bonus for losing no dolphins. */
export function pearlsForLevel(level: number, flawless: boolean): number {
  return 10 + Math.max(0, Math.floor(level)) + (flawless ? 5 : 0);
}

export const PEARLS_CAMPAIGN_CLEAR = 100;
export const PEARLS_FLAWLESS_CAMPAIGN_BONUS = 50;

/**
 * Milestone payout for liberating a depth zone in the Depthless Campaign, growing with depth:
 * 100 for the Eutrophic up to 300 for the Hadal, 1000 across a full descent to level 50.
 *
 * Sized against the Store rather than against the per-level trickle - the deepest liberation
 * buys a skin outright, which is what makes reaching it worth the ten levels it took.
 */
export const PEARLS_ZONE_CLEAR_BASE = 100;
export const PEARLS_ZONE_CLEAR_STEP = 50;

/** @param zoneNumber 1-based: 1 is the Eutrophic, 5 the Hadal. */
export function pearlsForZoneClear(zoneNumber: number): number {
  const n = Math.max(1, Math.floor(zoneNumber));
  return PEARLS_ZONE_CLEAR_BASE + (n - 1) * PEARLS_ZONE_CLEAR_STEP;
}
