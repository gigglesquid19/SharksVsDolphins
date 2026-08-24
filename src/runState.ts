import type { SharkKind } from './sprites';

const RUN_KEY = 'svsd-run';

export interface RunCheckpoint {
  level: number;
  vitalityLives: number;
  speedBonusPct: number;
  charismaBonusDolphins: number;
  sprintCooldownReduction: number;
  retries: number;
  totalRecruited: number;
  totalLost: number;
  sharksKilled: number;
  totalDolphinsSaved: number;
  elapsedSeconds: number;
  seenSharkKinds: SharkKind[];
  seenLargeSharkKinds: SharkKind[];
  seenLargeSharkVariety: boolean;
}

/** Saves a mid-run checkpoint (taken at each level start) so a closed tab can resume. */
export function saveRunCheckpoint(checkpoint: RunCheckpoint): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(checkpoint));
  } catch (e) {
    console.warn('Failed to save run checkpoint', e);
  }
}

export function loadRunCheckpoint(): RunCheckpoint | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to load run checkpoint', e);
    return null;
  }
}

/** Discards the checkpoint; call when a run ends or the player explicitly starts fresh. */
export function clearRunCheckpoint(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch (e) {
    console.warn('Failed to clear run checkpoint', e);
  }
}
