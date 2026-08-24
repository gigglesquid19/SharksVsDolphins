import { beforeEach, describe, expect, it } from 'vitest';
import { loadScores, saveScore } from './scoring';

function score(timeToSaveOcean: number) {
  return { timeToSaveOcean, retries: 0, recruited: 1, lost: 0, sharksKilled: 2 };
}

beforeEach(() => {
  localStorage.clear();
});

describe('loadScores', () => {
  it('returns an empty list when nothing has been saved', () => {
    expect(loadScores()).toEqual([]);
  });

  it('recovers gracefully from corrupted storage', () => {
    localStorage.setItem('svsd-scores', 'not json');
    expect(loadScores()).toEqual([]);
  });
});

describe('saveScore', () => {
  it('persists a run and stamps it with a date', () => {
    saveScore(score(42));
    const scores = loadScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].timeToSaveOcean).toBe(42);
    expect(typeof scores[0].date).toBe('string');
  });

  it('keeps the leaderboard sorted fastest-first', () => {
    saveScore(score(50));
    saveScore(score(10));
    saveScore(score(30));
    const scores = loadScores();
    expect(scores.map((s) => s.timeToSaveOcean)).toEqual([10, 30, 50]);
  });

  it('caps the leaderboard at 10 entries', () => {
    for (let i = 0; i < 15; i++) saveScore(score(i));
    const scores = loadScores();
    expect(scores).toHaveLength(10);
    expect(scores.map((s) => s.timeToSaveOcean)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
