const KEY = 'svsd-achievements-unlocked';

export type AchievementId = 'firstRecruit' | 'firstHuntingKill' | 'flawlessLevel' | 'stormSurvivor' | 'matriarchSlayer';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstRecruit', name: 'Making Friends', description: 'Recruit your first dolphin.', icon: '🐬' },
  { id: 'firstHuntingKill', name: 'Pack Hunter', description: 'Destroy a shark in Hunting Mode.', icon: '🦈' },
  { id: 'flawlessLevel', name: 'Flawless', description: 'Clear a level without losing a dolphin.', icon: '✨' },
  { id: 'stormSurvivor', name: 'Storm Survivor', description: 'Survive a storm.', icon: '🌩️' },
  { id: 'matriarchSlayer', name: 'Matriarch Slayer', description: 'Defeat the Matriarch.', icon: '👑' },
];

type UnlockedMap = Partial<Record<AchievementId, string>>;

function loadUnlocked(): UnlockedMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to load achievements', e);
    return {};
  }
}

export function isUnlocked(id: AchievementId): boolean {
  return id in loadUnlocked();
}

/** id -> ISO date string of when it was unlocked. */
export function getUnlockedMap(): UnlockedMap {
  return loadUnlocked();
}

/** Unlocks an achievement if it isn't already. Returns its definition on a new unlock, else null. */
export function unlock(id: AchievementId): AchievementDef | null {
  const unlocked = loadUnlocked();
  if (unlocked[id]) return null;
  unlocked[id] = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(unlocked));
  } catch (e) {
    console.warn('Failed to save achievement unlock', e);
  }
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}
