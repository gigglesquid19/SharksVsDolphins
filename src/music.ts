// BASE_URL is '/' for the app / dev and '/SharksVsDolphins/' for the GitHub Pages
// build, so these resolve under whatever sub-path the site is served from.
const B = import.meta.env.BASE_URL;

export const AMBIENT_TRACKS = [`${B}music/ambient-1.mp3`, `${B}music/ambient-2.mp3`, `${B}music/ambient-3.mp3`];
export const BOSS_TRACKS = [`${B}music/boss-1.mp3`, `${B}music/boss-2.mp3`, `${B}music/boss-3.mp3`];

export function pickRandomTrack(tracks: string[]): string {
  return tracks[Math.floor(Math.random() * tracks.length)];
}

/** Display names, short enough for a button. Full titles and credits live in CREDITS.md. */
const TITLES: Record<string, string> = {
  'ambient-1.mp3': 'Ocean Waves Chill',
  'ambient-2.mp3': 'The Ocean',
  'ambient-3.mp3': 'Enchanted Garden',
  'boss-1.mp3': 'Dark Fight',
  'boss-2.mp3': 'Fast Battle',
  'boss-3.mp3': 'Multi-Boss',
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
 * fight. An unrecognised or empty current track starts the ambient list from the top.
 */
export function nextTrackIn(current: string): string {
  const file = fileOf(current);
  for (const pool of [AMBIENT_TRACKS, BOSS_TRACKS]) {
    const index = pool.findIndex((t) => fileOf(t) === file);
    if (index >= 0) return pool[(index + 1) % pool.length];
  }
  return AMBIENT_TRACKS[0];
}
