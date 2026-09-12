import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls } from './pearls';
import {
  CONSUMABLES,
  CONSUMABLE_ORDER,
  MAGIC_SHRIMP_PRICE,
  MAX_MAGIC_SHRIMP,
  anyConsumableHeld,
  buyConsumable,
  buyMagicShrimp,
  consumableFull,
  consumableHeld,
  getInventory,
  magicShrimpFull,
  magicShrimpHeld,
  useConsumable,
  useMagicShrimp,
} from './inventory';

beforeEach(() => {
  localStorage.clear();
});

describe('default state', () => {
  it('starts with an empty pack', () => {
    expect(getInventory()).toEqual({ magicShrimp: 0, ghostShrimp: 0, pistolShrimp: 0 });
    expect(magicShrimpHeld()).toBe(0);
    expect(magicShrimpFull()).toBe(false);
  });

  it('recovers from corrupt storage', () => {
    localStorage.setItem('svsd-inventory', 'not json');
    expect(magicShrimpHeld()).toBe(0);
  });

  it('clamps a tampered count back into range', () => {
    localStorage.setItem('svsd-inventory', JSON.stringify({ magicShrimp: 99 }));
    expect(magicShrimpHeld()).toBe(MAX_MAGIC_SHRIMP);
    localStorage.setItem('svsd-inventory', JSON.stringify({ magicShrimp: -4 }));
    expect(magicShrimpHeld()).toBe(0);
  });
});

describe('buying', () => {
  it('spends the price and adds one', () => {
    awardPearls(500);
    expect(buyMagicShrimp()).toBe(true);
    expect(magicShrimpHeld()).toBe(1);
    expect(getPearls()).toBe(500 - MAGIC_SHRIMP_PRICE);
  });

  it('refuses when Pearls are short, spending nothing', () => {
    awardPearls(MAGIC_SHRIMP_PRICE - 1);
    expect(buyMagicShrimp()).toBe(false);
    expect(magicShrimpHeld()).toBe(0);
    expect(getPearls()).toBe(MAGIC_SHRIMP_PRICE - 1);
  });

  it('stops at the carry limit without charging for the refused purchase', () => {
    awardPearls(10_000);
    for (let i = 0; i < MAX_MAGIC_SHRIMP; i++) expect(buyMagicShrimp()).toBe(true);
    expect(magicShrimpHeld()).toBe(MAX_MAGIC_SHRIMP);
    expect(magicShrimpFull()).toBe(true);

    const before = getPearls();
    expect(buyMagicShrimp()).toBe(false);
    expect(getPearls()).toBe(before);
    expect(magicShrimpHeld()).toBe(MAX_MAGIC_SHRIMP);
  });
});

describe('using', () => {
  it('consumes one and persists the new count', () => {
    awardPearls(500);
    buyMagicShrimp();
    buyMagicShrimp();
    expect(useMagicShrimp()).toBe(true);
    expect(magicShrimpHeld()).toBe(1);
    expect(JSON.parse(localStorage.getItem('svsd-inventory') as string)).toEqual({
      magicShrimp: 1,
      ghostShrimp: 0,
      pistolShrimp: 0,
    });
  });

  it('refuses on an empty pack rather than going negative', () => {
    expect(useMagicShrimp()).toBe(false);
    expect(magicShrimpHeld()).toBe(0);
  });

  it('frees room to buy again once one is spent', () => {
    awardPearls(10_000);
    for (let i = 0; i < MAX_MAGIC_SHRIMP; i++) buyMagicShrimp();
    expect(buyMagicShrimp()).toBe(false);
    useMagicShrimp();
    expect(magicShrimpFull()).toBe(false);
    expect(buyMagicShrimp()).toBe(true);
  });
});

describe('the other kinds of shrimp', () => {
  it('buys, carries and spends each kind independently', () => {
    awardPearls(10_000);
    expect(buyConsumable('ghostShrimp')).toBe(true);
    expect(buyConsumable('pistolShrimp')).toBe(true);
    expect(buyConsumable('pistolShrimp')).toBe(true);

    expect(consumableHeld('ghostShrimp')).toBe(1);
    expect(consumableHeld('pistolShrimp')).toBe(2);
    expect(consumableHeld('magicShrimp')).toBe(0);

    expect(useConsumable('ghostShrimp')).toBe(true);
    expect(consumableHeld('ghostShrimp')).toBe(0);
    // Spending one kind leaves the others alone.
    expect(consumableHeld('pistolShrimp')).toBe(2);
    expect(useConsumable('ghostShrimp')).toBe(false);
  });

  it('holds each kind to its own carry limit', () => {
    awardPearls(100_000);
    for (const id of CONSUMABLE_ORDER) {
      for (let i = 0; i < CONSUMABLES[id].max; i++) expect(buyConsumable(id)).toBe(true);
      expect(consumableFull(id)).toBe(true);
      expect(buyConsumable(id)).toBe(false);
    }
  });

  it('charges each kind its own price', () => {
    awardPearls(10_000);
    const before = getPearls();
    buyConsumable('ghostShrimp');
    expect(getPearls()).toBe(before - CONSUMABLES.ghostShrimp.price);
  });

  it('reports whether anything at all is carried', () => {
    expect(anyConsumableHeld()).toBe(false);
    awardPearls(10_000);
    buyConsumable('pistolShrimp');
    expect(anyConsumableHeld()).toBe(true);
    useConsumable('pistolShrimp');
    expect(anyConsumableHeld()).toBe(false);
  });

  it('loads a save written before the new kinds existed', () => {
    localStorage.setItem('svsd-inventory', JSON.stringify({ magicShrimp: 2 }));
    expect(getInventory()).toEqual({ magicShrimp: 2, ghostShrimp: 0, pistolShrimp: 0 });
  });
});
