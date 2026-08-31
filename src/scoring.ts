import { DEFAULT_DOLPHIN_NAME } from './profile';

const MAX_SAVED_SCORES = 10;
const CAMPAIGN_KEY = 'svsd-scores-campaign';
const ENDLESS_KEY = 'svsd-scores-endless';

export interface CampaignScore {
  name: string;
  timeToSaveOcean: number;
  retries: number;
  recruited: number;
  lost: number;
  sharksKilled: number;
  date: string;
}

export type NewCampaignScore = Omit<CampaignScore, 'date'>;

/** Older records stored a 3-char `initials`; map it onto `name` so they still render. */
function withName<T extends { name?: string }>(rec: T): T {
  const legacy = (rec as { initials?: string }).initials;
  return { ...rec, name: rec.name ?? legacy ?? DEFAULT_DOLPHIN_NAME };
}

/** Saves a cleared-campaign run into the local top-10 campaign leaderboard, fastest-first. */
export function saveCampaignScore(score: NewCampaignScore): void {
  try {
    const scores = loadCampaignScores();
    scores.push({ ...score, date: new Date().toLocaleString() });
    scores.sort((a, b) => a.timeToSaveOcean - b.timeToSaveOcean);
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(scores.slice(0, MAX_SAVED_SCORES)));
  } catch (e) {
    console.warn('Failed to save campaign score', e);
  }
}

export function loadCampaignScores(): CampaignScore[] {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    return raw ? (JSON.parse(raw) as CampaignScore[]).map(withName) : [];
  } catch (e) {
    console.warn('Failed to load campaign scores', e);
    return [];
  }
}

export interface EndlessScore {
  name: string;
  levelReached: number;
  timeSurvived: number;
  recruited: number;
  sharksKilled: number;
  date: string;
}

export type NewEndlessScore = Omit<EndlessScore, 'date'>;

/** Saves an endless run into the local top-10 endless leaderboard, deepest level first (ties broken by survival time). */
export function saveEndlessScore(score: NewEndlessScore): void {
  try {
    const scores = loadEndlessScores();
    scores.push({ ...score, date: new Date().toLocaleString() });
    scores.sort((a, b) => b.levelReached - a.levelReached || b.timeSurvived - a.timeSurvived);
    localStorage.setItem(ENDLESS_KEY, JSON.stringify(scores.slice(0, MAX_SAVED_SCORES)));
  } catch (e) {
    console.warn('Failed to save endless score', e);
  }
}

export function loadEndlessScores(): EndlessScore[] {
  try {
    const raw = localStorage.getItem(ENDLESS_KEY);
    return raw ? (JSON.parse(raw) as EndlessScore[]).map(withName) : [];
  } catch (e) {
    console.warn('Failed to load endless scores', e);
    return [];
  }
}
