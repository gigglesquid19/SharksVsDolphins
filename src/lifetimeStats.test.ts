import { beforeEach, describe, expect, it } from 'vitest';
import { bumpLifetime, getLifetimeStats, recordPlayDay } from './lifetimeStats';

beforeEach(() => {
  localStorage.clear();
});

describe('bumpLifetime', () => {
  it('accumulates and returns the running total', () => {
    expect(bumpLifetime('sharksKilled', 3)).toBe(3);
    expect(bumpLifetime('sharksKilled', 4)).toBe(7);
    expect(getLifetimeStats().sharksKilled).toBe(7);
  });

  it('keeps the counters independent', () => {
    bumpLifetime('sharksKilled', 10);
    bumpLifetime('dolphinsSaved', 5);
    bumpLifetime('playSeconds', 120);
    const stats = getLifetimeStats();
    expect(stats).toMatchObject({ sharksKilled: 10, dolphinsSaved: 5, playSeconds: 120 });
  });

  it('recovers from corrupted storage by starting from zero', () => {
    localStorage.setItem('svsd-lifetime', 'not json');
    expect(bumpLifetime('sharksKilled', 2)).toBe(2);
  });
});

describe('recordPlayDay', () => {
  it('dedupes calls on the same day and counts distinct days', () => {
    expect(recordPlayDay()).toBe(1);
    expect(recordPlayDay()).toBe(1);
    // simulate a play on a different day
    const stats = getLifetimeStats();
    stats.playDays.push('2000-01-01');
    localStorage.setItem('svsd-lifetime', JSON.stringify(stats));
    expect(recordPlayDay()).toBe(2);
  });
});
