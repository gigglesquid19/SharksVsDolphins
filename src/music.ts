// BASE_URL is '/' for the app / dev and '/SharksVsDolphins/' for the GitHub Pages
// build, so these resolve under whatever sub-path the site is served from.
const B = import.meta.env.BASE_URL;

/**
 * The title/menu theme: plays behind the title and menu screens, while the game is showing its
 * idle preview rather than a level actually being played - see Game.applyMenuMusic.
 */
export const MENU_TRACK = `${B}music/menu.mp3`;

/**
 * Ambient tracks, grouped by depth zone - see DEPTH_ZONES in levels.ts, which these follow one
 * for one. Each zone's pool plays across that block's nine non-boss levels (its tenth is always
 * a Matriarch fight, which pulls from BOSS_TRACKS instead - see applyLevelMusic in game.ts).
 *
 * Only the first three zones have their own art yet. ambientTracksForLevel below falls back to
 * the deepest zone that does for anything past it, so the Abyssopelagic and the Hadal are not
 * silent for want of music, just not yet telling their own zone apart by ear.
 */
export const AMBIENT_ZONES: readonly (readonly string[])[] = [
  // Zone 1 - Eutrophic, levels 1-9
  [
    `${B}music/ambient/zone1/ocean-waves-chill.mp3`,
    `${B}music/ambient/zone1/ocean-joy.mp3`,
    `${B}music/ambient/zone1/wonders-of-the-ocean.mp3`,
    `${B}music/ambient/zone1/enchanted-garden.mp3`,
  ],
  // Zone 2 - Mesopelagic, levels 11-19
  [
    `${B}music/ambient/zone2/at-the-bottom-of-the-sea.mp3`,
    `${B}music/ambient/zone2/the-ocean.mp3`,
    `${B}music/ambient/zone2/coral-labyrinth.mp3`,
  ],
  // Zone 3 - Bathypelagic, levels 21-29
  [
    `${B}music/ambient/zone3/emotional.mp3`,
    `${B}music/ambient/zone3/epic-adventure.mp3`,
    `${B}music/ambient/zone3/sea-of-ghosts.mp3`,
  ],
];

/**
 * The two tracks a run is allowed to open on. Zone 1's pool of four plays across the whole of the
 * Eutrophic, but the first thing heard when a run actually starts is narrowed to these: they are
 * the two that set the tone the game opens on, and a run should not open on a coin toss between
 * four moods. Both are already in the zone 1 pool, so skipping forward still walks that pool
 * normally and the other two are only kept out of the opening slot, not out of the zone.
 */
export const OPENING_TRACKS: readonly string[] = [
  `${B}music/ambient/zone1/ocean-waves-chill.mp3`,
  `${B}music/ambient/zone1/enchanted-garden.mp3`,
];

export const BOSS_TRACKS = [
  `${B}music/boss/mad-world.mp3`,
  `${B}music/boss/dark-fight.mp3`,
  `${B}music/boss/fast-battle.mp3`,
  `${B}music/boss/multi-boss.mp3`,
];

/**
 * The ambient pool for whichever depth zone `level` falls in, ten levels per zone (matching
 * DEPTH_ZONES). Clamped to the deepest zone that actually has art, so a level past what has
 * been authored so far still gets a pool rather than an empty array.
 */
export function ambientTracksForLevel(level: number): readonly string[] {
  const zoneIndex = Math.max(0, Math.floor((level - 1) / 10));
  return AMBIENT_ZONES[Math.min(zoneIndex, AMBIENT_ZONES.length - 1)];
}

export function pickRandomTrack(tracks: readonly string[]): string {
  return tracks[Math.floor(Math.random() * tracks.length)];
}

/** Display names, short enough for a button. Full titles and credits live in CREDITS.md. */
const TITLES: Record<string, string> = {
  'menu.mp3': 'Ocean Waves Chill',
  'ocean-waves-chill.mp3': 'Ocean Waves Chill',
  'ocean-joy.mp3': 'Ocean Joy',
  'wonders-of-the-ocean.mp3': 'Wonders of the Ocean',
  'enchanted-garden.mp3': 'Fantasy Worlds – Enchanted Garden',
  'at-the-bottom-of-the-sea.mp3': 'At the Bottom of the Sea',
  'the-ocean.mp3': 'The Ocean',
  'coral-labyrinth.mp3': 'Coral Labyrinth',
  'emotional.mp3': 'Emotional',
  'epic-adventure.mp3': 'An Epic Adventure',
  'sea-of-ghosts.mp3': 'Sea of Ghosts',
  'mad-world.mp3': 'Mad World',
  'dark-fight.mp3': 'Dark Fight Music (Boss)',
  'fast-battle.mp3': 'Fast Battle – Intense 8-Bit Chiptune',
  'multi-boss.mp3': 'Multi-Boss – Fast-Paced 8-Bit Chiptune',
};

/** The filename part of a track URL. The <audio> element reports an absolute URL, while the
 *  lists above are BASE_URL-relative, so the two can only be compared on the filename. */
function fileOf(url: string): string {
  return url.split('/').pop() ?? '';
}

export function trackTitle(url: string): string {
  return TITLES[fileOf(url)] ?? 'Unknown track';
}

/**
 * The next track in whichever pool `current` belongs to, wrapping at the end. Staying inside the
 * pool is the point: skipping a boss track should not drop an ambient one into the Matriarch
 * fight, and skipping mid-zone should not jump to a different depth's music. An unrecognised or
 * empty current track starts the first ambient zone from the top.
 */
export function nextTrackIn(current: string): string {
  const file = fileOf(current);
  const pools: readonly (readonly string[])[] = [[MENU_TRACK], ...AMBIENT_ZONES, BOSS_TRACKS];
  for (const pool of pools) {
    const index = pool.findIndex((t) => fileOf(t) === file);
    if (index >= 0) return pool[(index + 1) % pool.length];
  }
  return AMBIENT_ZONES[0][0];
}
