const SEEN_KEY = 'svsd-tutorial-hints-seen';

export type HintId = 'formPod' | 'huntingMode' | 'megaShrimp';

function loadSeen(): Set<HintId> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    console.warn('Failed to load tutorial hint state', e);
    return new Set();
  }
}

/** Whether this first-run hint has already been shown, in this run or a previous one. */
export function hasSeenHint(id: HintId): boolean {
  return loadSeen().has(id);
}

export function markHintSeen(id: HintId): void {
  try {
    const seen = loadSeen();
    seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch (e) {
    console.warn('Failed to save tutorial hint state', e);
  }
}
