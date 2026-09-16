import { describe, expect, it } from 'vitest';
import {
  AMBIENT_ZONES,
  ambientTracksForLevel,
  BOSS_TRACKS,
  MENU_TRACK,
  nextTrackIn,
  OPENING_TRACKS,
  pickRandomTrack,
  trackTitle,
} from './music';

describe('track lists', () => {
  it('has three ambient zones and four boss tracks', () => {
    expect(AMBIENT_ZONES).toHaveLength(3);
    expect(BOSS_TRACKS).toHaveLength(4);
  });

  it('keeps every ambient zone, the boss pool and the menu track distinct', () => {
    const all = [MENU_TRACK, ...AMBIENT_ZONES.flat(), ...BOSS_TRACKS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('gives every zone at least one track', () => {
    for (const zone of AMBIENT_ZONES) expect(zone.length).toBeGreaterThan(0);
  });
});

describe('OPENING_TRACKS', () => {
  it('offers exactly the two tracks a run may open on', () => {
    expect(OPENING_TRACKS.map(trackTitle).sort()).toEqual([
      'Fantasy Worlds – Enchanted Garden',
      'Ocean Waves Chill',
    ]);
  });

  it('draws them from zone 1, so skipping forward still walks that pool', () => {
    // If an opening track were not in the zone's own pool, nextTrackIn would not recognise it and
    // the skip button would jump the player to the top of zone 1 instead of to the next track.
    for (const track of OPENING_TRACKS) {
      expect(AMBIENT_ZONES[0]).toContain(track);
      expect(AMBIENT_ZONES[0]).toContain(nextTrackIn(track));
    }
  });

  it('narrows the opening without shrinking the zone', () => {
    // The other two Eutrophic tracks are kept out of the opening slot only, not out of the zone.
    expect(OPENING_TRACKS.length).toBeLessThan(AMBIENT_ZONES[0].length);
    expect(AMBIENT_ZONES[0]).toHaveLength(4);
  });
});

describe('ambientTracksForLevel', () => {
  it('maps each ten-level block to its own zone', () => {
    expect(ambientTracksForLevel(1)).toBe(AMBIENT_ZONES[0]);
    expect(ambientTracksForLevel(9)).toBe(AMBIENT_ZONES[0]);
    expect(ambientTracksForLevel(10)).toBe(AMBIENT_ZONES[0]);
    expect(ambientTracksForLevel(11)).toBe(AMBIENT_ZONES[1]);
    expect(ambientTracksForLevel(20)).toBe(AMBIENT_ZONES[1]);
    expect(ambientTracksForLevel(21)).toBe(AMBIENT_ZONES[2]);
    expect(ambientTracksForLevel(30)).toBe(AMBIENT_ZONES[2]);
  });

  it('falls back to the deepest authored zone past it, rather than running out of music', () => {
    expect(ambientTracksForLevel(31)).toBe(AMBIENT_ZONES[AMBIENT_ZONES.length - 1]);
    expect(ambientTracksForLevel(41)).toBe(AMBIENT_ZONES[AMBIENT_ZONES.length - 1]);
    expect(ambientTracksForLevel(100)).toBe(AMBIENT_ZONES[AMBIENT_ZONES.length - 1]);
  });
});

describe('pickRandomTrack', () => {
  it('always returns one of the given tracks', () => {
    for (let i = 0; i < 20; i++) {
      expect(AMBIENT_ZONES[0]).toContain(pickRandomTrack(AMBIENT_ZONES[0]));
    }
  });

  it('is capable of returning every track given enough draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(pickRandomTrack(BOSS_TRACKS));
    expect(seen.size).toBe(BOSS_TRACKS.length);
  });
});

describe('nextTrackIn', () => {
  it('walks each ambient zone in order and wraps at the end, without crossing zones', () => {
    for (const zone of AMBIENT_ZONES) {
      let track = zone[0];
      const walked = [track];
      for (let i = 0; i < zone.length; i++) {
        track = nextTrackIn(track);
        walked.push(track);
      }
      expect(walked.slice(0, zone.length)).toEqual(zone);
      expect(walked[walked.length - 1]).toBe(zone[0]); // wrapped
    }
  });

  it('stays inside the boss pool, so skipping never leaves a boss fight', () => {
    let track = BOSS_TRACKS[0];
    for (let i = 0; i < 10; i++) {
      track = nextTrackIn(track);
      expect(BOSS_TRACKS).toContain(track);
    }
  });

  it('stays on the menu track, since it is a pool of one', () => {
    expect(nextTrackIn(MENU_TRACK)).toBe(MENU_TRACK);
  });

  it('matches on the filename, since the audio element reports an absolute URL', () => {
    const zone1 = AMBIENT_ZONES[0];
    const absolute = `https://example.test/SharksVsDolphins/music/ambient/zone1/${zone1[0].split('/').pop()}`;
    expect(nextTrackIn(absolute)).toBe(zone1[1]);
  });

  it('falls back to the first track of zone 1 for an unknown or empty source', () => {
    expect(nextTrackIn('')).toBe(AMBIENT_ZONES[0][0]);
    expect(nextTrackIn('https://example.test/music/nope.mp3')).toBe(AMBIENT_ZONES[0][0]);
  });
});

describe('trackTitle', () => {
  it('names every track, including the menu theme', () => {
    for (const track of [MENU_TRACK, ...AMBIENT_ZONES.flat(), ...BOSS_TRACKS]) {
      expect(trackTitle(track)).not.toBe('Unknown track');
    }
  });

  it('says so for anything it does not recognise', () => {
    expect(trackTitle('music/mystery.mp3')).toBe('Unknown track');
  });
});
