// BASE_URL is '/' for the app / dev and '/SharksVsDolphins/' for the GitHub Pages
// build, so these resolve under whatever sub-path the site is served from.
const B = import.meta.env.BASE_URL;

export const AMBIENT_TRACKS = [`${B}music/ambient-1.mp3`, `${B}music/ambient-2.mp3`, `${B}music/ambient-3.mp3`];
export const BOSS_TRACKS = [`${B}music/boss-1.mp3`, `${B}music/boss-2.mp3`, `${B}music/boss-3.mp3`];

export function pickRandomTrack(tracks: string[]): string {
  return tracks[Math.floor(Math.random() * tracks.length)];
}
