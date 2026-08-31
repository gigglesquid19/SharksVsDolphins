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
