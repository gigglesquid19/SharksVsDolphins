import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, getUnlockedMap, isUnlocked, unlock } from './achievements';

beforeEach(() => {
  localStorage.clear();
});

describe('ACHIEVEMENTS', () => {
  it('defines the full achievement set in order', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'firstRecruit',
      'firstHuntingKill',
      'flawlessLevel',
      'stormSurvivor',
      'matriarchSlayer',
      'halfwayThere',
      'speedrunner',
      'noDoOvers',
      'flawlessCampaign',
      'matriarchRematch',
      'deepDiver',
      'abyssal',
      'intoTheTrench',
      'megaPod',
      'homebound',
      'guardianOfThePod',
      'sharkCentury',
      'sharkaggeddon',
      'throughTheSwarm',
      'comeback',
      'devoted',
      'theLongGame',
    ]);
  });

  it('has no duplicate ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every achievement a name, description, and icon', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('isUnlocked', () => {
  it('returns false for anything not yet unlocked', () => {
    expect(isUnlocked('firstRecruit')).toBe(false);
  });

  it('recovers gracefully from corrupted storage', () => {
    localStorage.setItem('svsd-achievements-unlocked', 'not json');
    expect(isUnlocked('firstRecruit')).toBe(false);
  });
});

describe('unlock', () => {
  it('returns the achievement definition on first unlock', () => {
    const result = unlock('firstRecruit');
    expect(result?.id).toBe('firstRecruit');
    expect(isUnlocked('firstRecruit')).toBe(true);
  });

  it('returns null on a repeat unlock and keeps the original date', () => {
    unlock('firstRecruit');
    const before = getUnlockedMap().firstRecruit;
    const result = unlock('firstRecruit');
    expect(result).toBeNull();
    expect(getUnlockedMap().firstRecruit).toBe(before);
  });

  it('keeps achievements independent of each other', () => {
    unlock('firstRecruit');
    expect(isUnlocked('stormSurvivor')).toBe(false);
  });
});
