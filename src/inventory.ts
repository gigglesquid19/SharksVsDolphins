import { spendPearls } from './pearls';

const KEY = 'svsd-inventory';

/**
 * Consumables the player has bought and is carrying. Unlike the Store's upgrades and abilities,
 * which are owned once and forever, these are spent: bought with Pearls between runs and used up
 * during one. Kept apart from store.ts because the shape is different - a count that goes down.
 *
 * All three are shrimp, which is the fiction holding them together: the player is eating
 * something that gives the pod an edge for a while, not equipping a gadget.
 */
export type ConsumableId = 'magicShrimp' | 'ghostShrimp' | 'pistolShrimp';

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  /** Emoji shown on the store tile and the in-run button. */
  icon: string;
  price: number;
  /** Per-kind ceiling. The shared pack limit below is what usually binds first. */
  max: number;
  desc: string;
  /** Keyboard shortcut for spending one mid-run, shown in the Store copy. */
  key: string;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  magicShrimp: {
    id: 'magicShrimp',
    name: 'Magic Shrimp',
    icon: '\u{1F990}',
    price: 60,
    max: 3,
    desc: 'Spend one mid-run for +50% swim speed for the rest of the level. They stack.',
    key: 'Q',
  },
  ghostShrimp: {
    id: 'ghostShrimp',
    name: 'Ghost Shrimp',
    icon: '\u{1FAE7}',
    price: 90,
    max: 3,
    desc: 'Vanish for 30 seconds. Sharks lose your trail and cannot touch the pod.',
    key: 'F',
  },
  pistolShrimp: {
    id: 'pistolShrimp',
    name: 'Pistol Shrimp',
    icon: '\u{1F4A5}',
    price: 75,
    max: 3,
    desc: 'Snap a shockwave that blasts nearby sharks away and stuns them for 4 seconds.',
    key: 'R',
  },
};

export const CONSUMABLE_ORDER: ConsumableId[] = ['magicShrimp', 'ghostShrimp', 'pistolShrimp'];

/**
 * Total shrimp a player can carry, of any combination. Three of one, or one of each - the pack
 * has three slots and that is the whole of it.
 *
 * A shared limit rather than three of each kind: three separate pockets meant a well-off player
 * dived with nine escapes and never had to choose between speed, stealth and the blast. The
 * choosing is the interesting part.
 */
export const MAX_CONSUMABLE_SLOTS = 3;

export type Inventory = Record<ConsumableId, number>;

/** Kept as named exports because the Magic Shrimp price is quoted in the README and tests. */
export const MAGIC_SHRIMP_PRICE = CONSUMABLES.magicShrimp.price;
export const MAX_MAGIC_SHRIMP = CONSUMABLES.magicShrimp.max;

function empty(): Inventory {
  return { magicShrimp: 0, ghostShrimp: 0, pistolShrimp: 0 };
}

function clampCount(value: unknown, id: ConsumableId): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), CONSUMABLES[id].max);
}

/**
 * Trims a pack to the shared slot limit, in CONSUMABLE_ORDER. Saves written under the old rule
 * of three-of-each could hold nine, and a tampered one could hold anything; both have to come
 * back to three. Trimming from the end of the order rather than proportionally keeps it
 * predictable - the player loses the last kind they would have reached for, not a bit of each.
 */
function trimToSlots(inventory: Inventory): Inventory {
  let remaining = MAX_CONSUMABLE_SLOTS;
  for (const id of CONSUMABLE_ORDER) {
    const keep = Math.min(inventory[id], remaining);
    inventory[id] = keep;
    remaining -= keep;
  }
  return inventory;
}

function load(): Inventory {
  const base = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ConsumableId, unknown>>;
    // Missing keys stay at 0, so a save written before the Ghost and Pistol shrimp existed loads
    // without a migration step.
    for (const id of CONSUMABLE_ORDER) base[id] = clampCount(parsed[id], id);
    return trimToSlots(base);
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

export function consumableHeld(id: ConsumableId): number {
  return load()[id];
}

/** How many of the three slots are in use, across every kind. */
export function totalConsumablesHeld(): number {
  const inventory = load();
  return CONSUMABLE_ORDER.reduce((sum, id) => sum + inventory[id], 0);
}

/** Free slots in the pack. */
export function freeConsumableSlots(): number {
  return Math.max(0, MAX_CONSUMABLE_SLOTS - totalConsumablesHeld());
}

/** True when every slot is in use, whatever it is holding. */
export function packFull(): boolean {
  return freeConsumableSlots() === 0;
}

/** True when no more of this kind can be bought - either the pack is full or this kind is. */
export function consumableFull(id: ConsumableId): boolean {
  return packFull() || load()[id] >= CONSUMABLES[id].max;
}

/** Buys one. Fails if the pack is full or the Pearls are short, spending nothing. */
export function buyConsumable(id: ConsumableId): boolean {
  if (consumableFull(id)) return false;
  if (!spendPearls(CONSUMABLES[id].price)) return false;
  const inventory = load();
  inventory[id] = clampCount(inventory[id] + 1, id);
  save(inventory);
  return true;
}

/** Consumes one, returning false when there are none of that kind left to spend. */
export function useConsumable(id: ConsumableId): boolean {
  const inventory = load();
  if (inventory[id] <= 0) return false;
  inventory[id] -= 1;
  save(inventory);
  return true;
}

/** True when the player is carrying at least one of anything, so the HUD row is worth showing. */
export function anyConsumableHeld(): boolean {
  const inventory = load();
  return CONSUMABLE_ORDER.some((id) => inventory[id] > 0);
}

export function magicShrimpHeld(): number {
  return consumableHeld('magicShrimp');
}

export function magicShrimpFull(): boolean {
  return consumableFull('magicShrimp');
}

export function buyMagicShrimp(): boolean {
  return buyConsumable('magicShrimp');
}

export function useMagicShrimp(): boolean {
  return useConsumable('magicShrimp');
}
