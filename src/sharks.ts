import type { SharkKind } from './sprites';

/** Pod size that opens Hunting Mode, and the floor under every ram requirement below. */
export const HUNTING_MODE_POD_SIZE = 4;

/**
 * The last level on which a large great white is eased to 10 pod rather than 12.
 *
 * Levels 4 and 5 cap the pod at 12 (see levels.ts) and are the first to field a large great
 * white, so the standing requirement of 12 meant a flawless run - every dolphin ever recruited
 * still alive - just to make one killable.
 */
export const GREAT_WHITE_EASED_UNTIL_LEVEL = 5;

/**
 * How many dolphins it takes to ram one of these to death.
 *
 * Lives here rather than on Game because two places need the same answer and must not be able to
 * disagree about it: the kill loop, which enforces it, and the Sharkopedia, which promises it.
 * A large shark needs a Boost dash at the moment of contact on top of the number.
 */
export function podRequirement(kind: SharkKind, large: boolean, level: number): number {
  if (large) {
    if (kind === 'tiger') return 8;
    if (kind === 'greatWhite') return level <= GREAT_WHITE_EASED_UNTIL_LEVEL ? 10 : 12;
    if (kind === 'hammerhead') return 10;
    // Both kept above their small forms below, so size never makes one cheaper to ram.
    if (kind === 'frilled') return 12;
    if (kind === 'cookiecutter') return 8;
  } else {
    if (kind === 'tiger') return 4;
    if (kind === 'greatWhite') return 5;
    if (kind === 'hammerhead') return 4;
    // The frilled shark costs far more pod than its size suggests, which is the point of it: it
    // is not something a working pod rams on the way past, it is a pod's worth of work on a
    // level that caps at 15 - but it leaves room to still be running one down while the rest of
    // the water is happening, which asking for ten did not. Seven rather than eight, since a pod
    // that has taken any losses at all spends most of a level under eight and the species then
    // reads as unkillable rather than expensive. The cookiecutter sits right at the 4 that opens
    // Hunting Mode, so a pod that can hunt at all can already clear one out of the way.
    if (kind === 'frilled') return 7;
    if (kind === 'cookiecutter') return 4;
  }
  return HUNTING_MODE_POD_SIZE;
}

/**
 * What the Sharkopedia prints for a requirement that is not the same at every depth.
 *
 * Only the large great white has one, and hiding that behind a single number would make the
 * entry wrong on one side of level 5 or the other.
 */
export function podRequirementLabel(kind: SharkKind, large: boolean): string {
  const eased = podRequirement(kind, large, GREAT_WHITE_EASED_UNTIL_LEVEL);
  const full = podRequirement(kind, large, GREAT_WHITE_EASED_UNTIL_LEVEL + 1);
  return eased === full ? String(full) : `${eased}-${full}`;
}
