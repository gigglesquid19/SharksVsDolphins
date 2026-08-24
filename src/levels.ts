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
  return `levels/${level}.jpg`;
}
