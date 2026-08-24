const SCORES_KEY = 'svsd-scores';
const MAX_SAVED_SCORES = 10;

export interface RunScore {
  timeToSaveOcean: number;
  retries: number;
  recruited: number;
  lost: number;
  sharksKilled: number;
}

export type SavedScore = RunScore & { date: string };

/** Saves a completed run's score into the local top-10 leaderboard, sorted fastest-first. */
export function saveScore(score: RunScore): void {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const scores: SavedScore[] = raw ? JSON.parse(raw) : [];
    scores.push({ ...score, date: new Date().toLocaleString() });
    scores.sort((a, b) => a.timeToSaveOcean - b.timeToSaveOcean);
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, MAX_SAVED_SCORES)));
  } catch (e) {
    console.warn('Failed to save score', e);
  }
}

/** Loads the local top-10 leaderboard, fastest-first. */
export function loadScores(): SavedScore[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load scores', e);
    return [];
  }
}
