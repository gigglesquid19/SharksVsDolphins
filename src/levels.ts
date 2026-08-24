import type { SharkKind } from './sprites';

export interface LevelConfig {
  level: number;
  sharkKinds: SharkKind[];
  normalSharkCount: number;
  largeSharkCount: number;
  largeSharkPodRequirement: number;
  maxDolphins: number;
  sharkSpeedMultiplier: number;
  matriarch?: boolean;
}

const TIGER: SharkKind[] = ['tiger'];
const TIGER_GREAT_WHITE: SharkKind[] = ['tiger', 'greatWhite'];
const ALL_KINDS: SharkKind[] = ['tiger', 'greatWhite', 'hammerhead'];

export const LEVELS: LevelConfig[] = [
  { level: 1, sharkKinds: TIGER, normalSharkCount: 4, largeSharkCount: 0, largeSharkPodRequirement: 5, maxDolphins: 8, sharkSpeedMultiplier: 1.0 },
  { level: 2, sharkKinds: TIGER, normalSharkCount: 5, largeSharkCount: 0, largeSharkPodRequirement: 5, maxDolphins: 8, sharkSpeedMultiplier: 1.03 },
  { level: 3, sharkKinds: TIGER, normalSharkCount: 5, largeSharkCount: 1, largeSharkPodRequirement: 9, maxDolphins: 10, sharkSpeedMultiplier: 1.06 },
  { level: 4, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 6, largeSharkCount: 1, largeSharkPodRequirement: 9, maxDolphins: 12, sharkSpeedMultiplier: 1.09 },
  { level: 5, sharkKinds: TIGER_GREAT_WHITE, normalSharkCount: 6, largeSharkCount: 2, largeSharkPodRequirement: 10, maxDolphins: 12, sharkSpeedMultiplier: 1.12 },
  { level: 6, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 2, largeSharkPodRequirement: 10, maxDolphins: 12, sharkSpeedMultiplier: 1.15 },
  { level: 7, sharkKinds: ALL_KINDS, normalSharkCount: 7, largeSharkCount: 3, largeSharkPodRequirement: 11, maxDolphins: 12, sharkSpeedMultiplier: 1.18 },
  { level: 8, sharkKinds: ALL_KINDS, normalSharkCount: 8, largeSharkCount: 3, largeSharkPodRequirement: 12, maxDolphins: 13, sharkSpeedMultiplier: 1.21 },
  { level: 9, sharkKinds: ALL_KINDS, normalSharkCount: 8, largeSharkCount: 4, largeSharkPodRequirement: 13, maxDolphins: 14, sharkSpeedMultiplier: 1.24 },
  { level: 10, sharkKinds: ALL_KINDS, normalSharkCount: 9, largeSharkCount: 4, largeSharkPodRequirement: 14, maxDolphins: 15, sharkSpeedMultiplier: 1.27, matriarch: true }
];

export function getLevelBackground(level: number): string {
  const bgIndex = ((level - 1) % LEVELS.length) + 1;
  return `levels/${bgIndex}.webp`;
}

/**
 * Endless-mode scaling past the 10-level campaign: shark counts, pod
 * requirements, and max pod size grow then cap out so late levels stay
 * playable, while speed keeps climbing indefinitely - that's what
 * eventually ends an endless run. The matriarch reappears every 5 levels
 * as a recurring boss beat.
 */
export function getEndlessLevelConfig(level: number): LevelConfig {
  const over = level - LEVELS.length;
  return {
    level,
    sharkKinds: ALL_KINDS,
    normalSharkCount: Math.min(9 + Math.ceil(over / 3), 16),
    largeSharkCount: Math.min(4 + Math.ceil(over / 3), 10),
    largeSharkPodRequirement: Math.min(14 + Math.ceil(over / 2), 20),
    maxDolphins: Math.min(15 + Math.floor(over / 4), 20),
    sharkSpeedMultiplier: 1.27 + over * 0.03,
    matriarch: over % 5 === 0,
  };
}

/** Resolves the config for any level: campaign levels 1-10 as authored, beyond that endless scaling. */
export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= LEVELS.length) return LEVELS[level - 1];
  return getEndlessLevelConfig(level);
}
