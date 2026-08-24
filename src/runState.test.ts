import { beforeEach, describe, expect, it } from 'vitest';
import { clearRunCheckpoint, loadRunCheckpoint, saveRunCheckpoint, RunCheckpoint } from './runState';

function checkpoint(overrides: Partial<RunCheckpoint> = {}): RunCheckpoint {
  return {
    level: 3,
    vitalityLives: 1,
    speedBonusPct: 0.1,
    charismaBonusDolphins: 1,
    sprintCooldownReduction: 1500,
    retries: 2,
    totalRecruited: 5,
    totalLost: 1,
    sharksKilled: 4,
    elapsedSeconds: 123.4,
    seenSharkKinds: ['tiger'],
    seenLargeSharkKinds: [],
    seenLargeSharkVariety: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('loadRunCheckpoint', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadRunCheckpoint()).toBeNull();
  });

  it('recovers gracefully from corrupted storage', () => {
    localStorage.setItem('svsd-run', 'not json');
    expect(loadRunCheckpoint()).toBeNull();
  });
});

describe('saveRunCheckpoint / clearRunCheckpoint', () => {
  it('round-trips a checkpoint', () => {
    saveRunCheckpoint(checkpoint());
    expect(loadRunCheckpoint()).toEqual(checkpoint());
  });

  it('overwrites the previous checkpoint rather than accumulating', () => {
    saveRunCheckpoint(checkpoint({ level: 3 }));
    saveRunCheckpoint(checkpoint({ level: 4 }));
    expect(loadRunCheckpoint()?.level).toBe(4);
  });

  it('clears the checkpoint', () => {
    saveRunCheckpoint(checkpoint());
    clearRunCheckpoint();
    expect(loadRunCheckpoint()).toBeNull();
  });
});
