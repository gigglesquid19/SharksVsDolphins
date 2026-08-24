export const AMBIENT_TRACKS = ['/music/ambient-1.mp3', '/music/ambient-2.mp3', '/music/ambient-3.mp3'];
export const BOSS_TRACKS = ['/music/boss-1.mp3', '/music/boss-2.mp3', '/music/boss-3.mp3'];

export function pickRandomTrack(tracks: string[]): string {
  return tracks[Math.floor(Math.random() * tracks.length)];
}
