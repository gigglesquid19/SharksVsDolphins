const KEY = 'svsd-progress';

/**
 * Campaign milestones that outlive a single run and gate content elsewhere. Kept apart from
 * lifetimeStats (which is counters) and from the Store (which is what you spent Pearls on):
 * this is what the player has *achieved*, and the Store reads it to decide what may be bought.
 */
export interface Progress {
  /** True once the campaign has been cleared at least once. Unlocks Echolocation in the Store. */
  campaignCleared: boolean;
  /**
   * The deepest Depthless level ever cleared, across every run. Unlocks Iron Skin at 30.
   *
   * Deepest rather than a set of levels: the descent is linear, so one number says everything a
   * gate needs to ask. It counts a level bought into as well as one descended to - a depth that
   * was paid for is still a depth that was survived, and the Pearls it cost were earned somewhere.
   */
  deepestLevelCleared: number;
}

function empty(): Progress {
  return { campaignCleared: false, deepestLevelCleared: 0 };
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const deepest = Math.floor(Number(parsed.deepestLevelCleared));
    return {
      campaignCleared: parsed.campaignCleared === true,
      deepestLevelCleared: Number.isFinite(deepest) && deepest > 0 ? deepest : 0,
    };
  } catch (e) {
    console.warn('Failed to load progress', e);
    return empty();
  }
}

function save(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save progress', e);
  }
}

export function getProgress(): Progress {
  return load();
}

export function hasClearedCampaign(): boolean {
  return load().campaignCleared;
}

/** Records a campaign clear. Returns true only the first time, so callers can celebrate once. */
export function markCampaignCleared(): boolean {
  const progress = load();
  if (progress.campaignCleared) return false;
  progress.campaignCleared = true;
  save(progress);
  return true;
}

/**
 * Records a cleared level, keeping only the deepest. Returns true if this is a new record, so a
 * caller can say something about it.
 */
export function markLevelCleared(level: number): boolean {
  const depth = Math.floor(level);
  if (!Number.isFinite(depth) || depth <= 0) return false;
  const progress = load();
  if (depth <= progress.deepestLevelCleared) return false;
  progress.deepestLevelCleared = depth;
  save(progress);
  return true;
}

export function deepestLevelCleared(): number {
  return load().deepestLevelCleared;
}

/** Whether the player has ever cleared this depth or deeper. */
export function hasClearedLevel(level: number): boolean {
  return load().deepestLevelCleared >= level;
}
