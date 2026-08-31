import { beforeEach, describe, expect, it } from 'vitest';
import { loadCampaignScores, loadEndlessScores, saveCampaignScore, saveEndlessScore } from './scoring';

function campaignScore(timeToSaveOcean: number) {
  return { name: 'Echo', timeToSaveOcean, retries: 0, recruited: 1, lost: 0, sharksKilled: 2 };
}

function endlessScore(levelReached: number, timeSurvived = 100) {
  return { name: 'Splash', levelReached, timeSurvived, recruited: 1, sharksKilled: 2 };
}

beforeEach(() => {
  localStorage.clear();
});

describe('campaign scores', () => {
  it('returns an empty list when nothing has been saved', () => {
    expect(loadCampaignScores()).toEqual([]);
  });

  it('recovers gracefully from corrupted storage', () => {
    localStorage.setItem('svsd-scores-campaign', 'not json');
    expect(loadCampaignScores()).toEqual([]);
  });

  it('persists the name and stamps a date', () => {
    saveCampaignScore(campaignScore(42));
    const scores = loadCampaignScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].name).toBe('Echo');
    expect(typeof scores[0].date).toBe('string');
  });

  it('reads a legacy `initials` record back as `name`', () => {
    localStorage.setItem(
      'svsd-scores-campaign',
      JSON.stringify([{ initials: 'XYZ', timeToSaveOcean: 5, retries: 0, recruited: 0, lost: 0, sharksKilled: 0, date: 'x' }])
    );
    expect(loadCampaignScores()[0].name).toBe('XYZ');
  });

  it('keeps the leaderboard sorted fastest-first', () => {
    saveCampaignScore(campaignScore(50));
    saveCampaignScore(campaignScore(10));
    saveCampaignScore(campaignScore(30));
    expect(loadCampaignScores().map((s) => s.timeToSaveOcean)).toEqual([10, 30, 50]);
  });

  it('caps the leaderboard at 10 entries', () => {
    for (let i = 0; i < 15; i++) saveCampaignScore(campaignScore(i));
    expect(loadCampaignScores()).toHaveLength(10);
  });
});

describe('endless scores', () => {
  it('returns an empty list when nothing has been saved', () => {
    expect(loadEndlessScores()).toEqual([]);
  });

  it('keeps the leaderboard sorted deepest-level-first', () => {
    saveEndlessScore(endlessScore(12));
    saveEndlessScore(endlessScore(20));
    saveEndlessScore(endlessScore(15));
    expect(loadEndlessScores().map((s) => s.levelReached)).toEqual([20, 15, 12]);
  });

  it('breaks ties on level reached by longer survival time', () => {
    saveEndlessScore(endlessScore(15, 50));
    saveEndlessScore(endlessScore(15, 90));
    expect(loadEndlessScores().map((s) => s.timeSurvived)).toEqual([90, 50]);
  });

  it('is stored separately from the campaign leaderboard', () => {
    saveEndlessScore(endlessScore(15));
    expect(loadCampaignScores()).toEqual([]);
  });
});
