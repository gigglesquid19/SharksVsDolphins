import { describe, expect, it } from 'vitest';
import { AMBIENT_TRACKS, BOSS_TRACKS, nextTrackIn, pickRandomTrack, trackTitle } from './music';

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

describe('nextTrackIn', () => {
  it('walks the ambient list in order and wraps at the end', () => {
    let track = AMBIENT_TRACKS[0];
    const walked = [track];
    for (let i = 0; i < AMBIENT_TRACKS.length; i++) {
      track = nextTrackIn(track);
      walked.push(track);
    }
    expect(walked.slice(0, AMBIENT_TRACKS.length)).toEqual(AMBIENT_TRACKS);
    expect(walked[walked.length - 1]).toBe(AMBIENT_TRACKS[0]); // wrapped
  });

  it('stays inside the boss pool, so skipping never leaves a boss fight', () => {
    let track = BOSS_TRACKS[0];
    for (let i = 0; i < 10; i++) {
      track = nextTrackIn(track);
      expect(BOSS_TRACKS).toContain(track);
    }
  });

  it('matches on the filename, since the audio element reports an absolute URL', () => {
    const absolute = `https://example.test/SharksVsDolphins/music/ambient-1.mp3`;
    expect(nextTrackIn(absolute)).toBe(AMBIENT_TRACKS[1]);
  });

  it('falls back to the first ambient track for an unknown or empty source', () => {
    expect(nextTrackIn('')).toBe(AMBIENT_TRACKS[0]);
    expect(nextTrackIn('https://example.test/music/nope.mp3')).toBe(AMBIENT_TRACKS[0]);
  });
});

describe('trackTitle', () => {
  it('names every track in both pools', () => {
    for (const track of [...AMBIENT_TRACKS, ...BOSS_TRACKS]) {
      expect(trackTitle(track)).not.toBe('Unknown track');
    }
  });

  it('says so for anything it does not recognise', () => {
    expect(trackTitle('music/mystery.mp3')).toBe('Unknown track');
  });
});
