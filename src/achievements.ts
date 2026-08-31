const KEY = 'svsd-achievements-unlocked';

export type AchievementId =
  | 'firstRecruit'
  | 'firstHuntingKill'
  | 'flawlessLevel'
  | 'stormSurvivor'
  | 'matriarchSlayer'
  | 'halfwayThere'
  | 'speedrunner'
  | 'noDoOvers'
  | 'flawlessCampaign'
  | 'matriarchRematch'
  | 'deepDiver'
  | 'abyssal'
  | 'intoTheTrench'
  | 'megaPod'
  | 'homebound'
  | 'guardianOfThePod'
  | 'sharkCentury'
  | 'sharkaggeddon'
  | 'throughTheSwarm'
  | 'comeback'
  | 'devoted'
  | 'theLongGame';

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

  // Campaign milestones
  { id: 'halfwayThere', name: 'Halfway There', description: 'Clear campaign level 5.', icon: '🌊' },
  { id: 'speedrunner', name: 'Speedrunner', description: 'Clear the campaign in under 12 minutes.', icon: '⏱️' },
  { id: 'noDoOvers', name: 'No Do-Overs', description: 'Clear the campaign without a single retry.', icon: '🎯' },
  { id: 'flawlessCampaign', name: 'Flawless Campaign', description: 'Clear the whole campaign without losing a dolphin.', icon: '💎' },

  // Endless depth
  { id: 'matriarchRematch', name: 'Matriarch Rematch', description: 'Beat the Matriarch a second time in Endless.', icon: '⚔️' },
  { id: 'deepDiver', name: 'Deep Diver', description: 'Reach Endless level 15.', icon: '🤿' },
  { id: 'abyssal', name: 'Abyssal', description: 'Reach Endless level 25.', icon: '🕳️' },
  { id: 'intoTheTrench', name: 'Into the Trench', description: 'Reach Endless level 40.', icon: '🧭' },

  // Pod
  { id: 'megaPod', name: 'Mega Pod', description: 'Summon the Mega Pod for the finale.', icon: '🐋' },
  { id: 'homebound', name: 'Homebound', description: 'Save 100 dolphins in total.', icon: '🏠' },
  { id: 'guardianOfThePod', name: 'Guardian of the Pod', description: 'Save 1,000 dolphins in total.', icon: '🛡️' },

  // Combat
  { id: 'sharkCentury', name: 'Shark Century', description: 'Destroy 100 sharks in total.', icon: '💯' },
  { id: 'sharkaggeddon', name: 'Sharkaggeddon', description: 'Destroy 1,000 sharks in total.', icon: '💥' },

  // Mechanics / meta
  { id: 'throughTheSwarm', name: 'Through the Swarm', description: 'Cross a jellyfish swarm without losing a dolphin.', icon: '🪼' },
  { id: 'comeback', name: 'Comeback', description: 'Clear a level after being down to your last life.', icon: '🔥' },
  { id: 'devoted', name: 'Devoted', description: 'Play on 7 separate days.', icon: '📅' },
  { id: 'theLongGame', name: 'The Long Game', description: 'Play for 10 hours in total.', icon: '⏳' },
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
