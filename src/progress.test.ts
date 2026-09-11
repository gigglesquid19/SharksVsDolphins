import { beforeEach, describe, expect, it } from 'vitest';
import { getProgress, hasClearedCampaign, markCampaignCleared } from './progress';

beforeEach(() => {
  localStorage.clear();
});

describe('progress', () => {
  it('starts with nothing cleared', () => {
    expect(hasClearedCampaign()).toBe(false);
    expect(getProgress()).toEqual({ campaignCleared: false });
  });

  it('records a campaign clear and persists it', () => {
    expect(markCampaignCleared()).toBe(true);
    expect(hasClearedCampaign()).toBe(true);
    // Survives a reload: the flag lives in localStorage, not in module state.
    expect(JSON.parse(localStorage.getItem('svsd-progress') as string)).toEqual({ campaignCleared: true });
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
