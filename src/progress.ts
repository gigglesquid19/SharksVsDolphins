const KEY = 'svsd-progress';

/**
 * Campaign milestones that outlive a single run and gate content elsewhere. Kept apart from
 * lifetimeStats (which is counters) and from the Store (which is what you spent Pearls on):
 * this is what the player has *achieved*, and the Store reads it to decide what may be bought.
 */
export interface Progress {
  /** True once the campaign has been cleared at least once. Unlocks Echolocation in the Store. */
  campaignCleared: boolean;
}

function empty(): Progress {
  return { campaignCleared: false };
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { campaignCleared: parsed.campaignCleared === true };
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
