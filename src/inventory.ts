import { spendPearls } from './pearls';

const KEY = 'svsd-inventory';

/**
 * Consumables the player has bought and is carrying. Unlike the Store's upgrades and abilities,
 * which are owned once and forever, these are spent: bought with Pearls between runs and used up
 * during one. Kept apart from store.ts because the shape is different - a count that goes down.
 */
export interface Inventory {
  magicShrimp: number;
}

/** Carrying more than a few would turn a run into a sequence of guaranteed boosts. */
export const MAX_MAGIC_SHRIMP = 3;
export const MAGIC_SHRIMP_PRICE = 60;

function empty(): Inventory {
  return { magicShrimp: 0 };
}

function clampCount(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), MAX_MAGIC_SHRIMP);
}

function load(): Inventory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Inventory>;
    return { magicShrimp: clampCount(parsed.magicShrimp) };
  } catch (e) {
    console.warn('Failed to load inventory', e);
    return empty();
  }
}

function save(inventory: Inventory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(inventory));
  } catch (e) {
    console.warn('Failed to save inventory', e);
  }
}

export function getInventory(): Inventory {
  return load();
}

export function magicShrimpHeld(): number {
  return load().magicShrimp;
}

/** True when the player is carrying the maximum and cannot buy another. */
export function magicShrimpFull(): boolean {
  return load().magicShrimp >= MAX_MAGIC_SHRIMP;
}

/** Buys one Magic Shrimp. Fails if the pack is full or the Pearls are short, spending nothing. */
export function buyMagicShrimp(): boolean {
  if (magicShrimpFull()) return false;
  if (!spendPearls(MAGIC_SHRIMP_PRICE)) return false;
  const inventory = load();
  inventory.magicShrimp = clampCount(inventory.magicShrimp + 1);
  save(inventory);
  return true;
}

/** Consumes one Magic Shrimp, returning false when there are none left to spend. */
export function useMagicShrimp(): boolean {
  const inventory = load();
  if (inventory.magicShrimp <= 0) return false;
  inventory.magicShrimp -= 1;
  save(inventory);
  return true;
}
