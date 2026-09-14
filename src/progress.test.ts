import { beforeEach, describe, expect, it } from 'vitest';
import {
  deepestLevelCleared,
  getProgress,
  hasClearedCampaign,
  hasClearedLevel,
  markCampaignCleared,
  markLevelCleared,
} from './progress';

beforeEach(() => {
  localStorage.clear();
});

describe('progress', () => {
  it('starts with nothing cleared', () => {
    expect(hasClearedCampaign()).toBe(false);
    expect(getProgress()).toEqual({ campaignCleared: false, deepestLevelCleared: 0 });
  });

  it('records a campaign clear and persists it', () => {
    expect(markCampaignCleared()).toBe(true);
    expect(hasClearedCampaign()).toBe(true);
    // Survives a reload: the flag lives in localStorage, not in module state.
    expect(JSON.parse(localStorage.getItem('svsd-progress') as string)).toEqual({
      campaignCleared: true,
      deepestLevelCleared: 0,
    });
  });

  it('reports only the first clear, so callers can celebrate once', () => {
    expect(markCampaignCleared()).toBe(true);
    expect(markCampaignCleared()).toBe(false);
    expect(hasClearedCampaign()).toBe(true);
  });

  it('recovers from corrupt storage', () => {
    localStorage.setItem('svsd-progress', 'not json');
    expect(hasClearedCampaign()).toBe(false);
  });

  it('ignores a non-boolean flag rather than trusting it', () => {
    localStorage.setItem('svsd-progress', JSON.stringify({ campaignCleared: 'yes' }));
    expect(hasClearedCampaign()).toBe(false);
  });
});

describe('the deepest level cleared', () => {
  it('starts at nothing, and gates on nothing', () => {
    expect(deepestLevelCleared()).toBe(0);
    expect(hasClearedLevel(1)).toBe(false);
    expect(hasClearedLevel(30)).toBe(false);
  });

  it('records a clear and answers the gate', () => {
    expect(markLevelCleared(30)).toBe(true);
    expect(deepestLevelCleared()).toBe(30);
    expect(hasClearedLevel(30)).toBe(true);
    expect(hasClearedLevel(29)).toBe(true);
    expect(hasClearedLevel(31)).toBe(false);
  });

  it('keeps the deepest rather than the latest, so a shallow run never takes it away', () => {
    markLevelCleared(30);
    expect(markLevelCleared(12)).toBe(false);
    expect(deepestLevelCleared()).toBe(30);
  });

  it('reports only a new record, so a caller can celebrate once', () => {
    expect(markLevelCleared(8)).toBe(true);
    expect(markLevelCleared(8)).toBe(false);
    expect(markLevelCleared(9)).toBe(true);
  });

  it('refuses nonsense rather than storing it', () => {
    expect(markLevelCleared(0)).toBe(false);
    expect(markLevelCleared(-3)).toBe(false);
    expect(markLevelCleared(Number.NaN)).toBe(false);
    expect(deepestLevelCleared()).toBe(0);
  });

  it('survives a corrupt or missing depth', () => {
    localStorage.setItem('svsd-progress', JSON.stringify({ campaignCleared: true, deepestLevelCleared: 'deep' }));
    expect(deepestLevelCleared()).toBe(0);
    expect(hasClearedCampaign()).toBe(true);
  });

  it('carries a campaign clear alongside it without either disturbing the other', () => {
    markCampaignCleared();
    markLevelCleared(30);
    expect(getProgress()).toEqual({ campaignCleared: true, deepestLevelCleared: 30 });
  });
});
