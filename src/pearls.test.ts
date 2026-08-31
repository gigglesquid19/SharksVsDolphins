import { beforeEach, describe, expect, it } from 'vitest';
import { awardPearls, getPearls, pearlsForLevel, spendPearls } from './pearls';

beforeEach(() => {
  localStorage.clear();
});

describe('getPearls / awardPearls', () => {
  it('starts at zero', () => {
    expect(getPearls()).toBe(0);
  });

  it('accumulates awards and persists the balance', () => {
    expect(awardPearls(12)).toBe(12);
    expect(getPearls()).toBe(12);
    expect(awardPearls(8)).toBe(20);
    expect(getPearls()).toBe(20);
  });

  it('ignores non-positive awards', () => {
    awardPearls(10);
    expect(awardPearls(0)).toBe(10);
    expect(awardPearls(-5)).toBe(10);
    expect(getPearls()).toBe(10);
  });

  it('recovers from corrupted storage by reading zero', () => {
    localStorage.setItem('svsd-pearls', 'not json');
    expect(getPearls()).toBe(0);
    expect(awardPearls(3)).toBe(3);
  });
});

describe('spendPearls', () => {
  it('deducts and returns true when affordable', () => {
    awardPearls(100);
    expect(spendPearls(30)).toBe(true);
    expect(getPearls()).toBe(70);
  });

  it('returns false and changes nothing when too expensive or non-positive', () => {
    awardPearls(20);
    expect(spendPearls(50)).toBe(false);
    expect(spendPearls(0)).toBe(false);
    expect(spendPearls(-10)).toBe(false);
    expect(getPearls()).toBe(20);
  });
});

describe('pearlsForLevel', () => {
  it('pays a base that grows with depth', () => {
    expect(pearlsForLevel(1, false)).toBe(11);
    expect(pearlsForLevel(10, false)).toBe(20);
  });

  it('adds a flawless bonus', () => {
    expect(pearlsForLevel(1, true)).toBe(16);
  });
});
