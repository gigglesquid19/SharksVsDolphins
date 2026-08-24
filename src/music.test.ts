import { describe, expect, it } from 'vitest';
import { AMBIENT_TRACKS, BOSS_TRACKS, pickRandomTrack } from './music';

describe('track lists', () => {
  it('has three ambient and three boss tracks', () => {
    expect(AMBIENT_TRACKS).toHaveLength(3);
    expect(BOSS_TRACKS).toHaveLength(3);
  });

  it('keeps ambient and boss tracks distinct', () => {
    const overlap = AMBIENT_TRACKS.filter((t) => BOSS_TRACKS.includes(t));
    expect(overlap).toHaveLength(0);
  });
});

describe('pickRandomTrack', () => {
  it('always returns one of the given tracks', () => {
    for (let i = 0; i < 20; i++) {
      expect(AMBIENT_TRACKS).toContain(pickRandomTrack(AMBIENT_TRACKS));
    }
  });

  it('is capable of returning every track given enough draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickRandomTrack(BOSS_TRACKS));
    expect(seen.size).toBe(BOSS_TRACKS.length);
  });
});
