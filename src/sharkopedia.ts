import type { SharkKind } from './sprites';
import { podRequirementLabel } from './sharks';

const KEY = 'svsd-sharkopedia';

/**
 * The Sharkopedia: every shark in the game, and which of them the player has actually met.
 *
 * Two halves that are deliberately kept apart. The roster below is fixed and knows nothing about
 * any particular player - it is the complete list, including the entries that should show as a
 * shadow. What the player has seen is a set of ids in storage, and the view crosses the two. That
 * way the gaps in the book are as authored as the entries: a species that exists but has not been
 * met still occupies its slot in the order, so the shape of what is missing is itself information.
 *
 * Encounters are lifetime rather than per-run. A book that emptied itself every time a run ended
 * would not be a record of anything.
 */

/** Which life stage an entry is. The game calls them small and large; the book is less blunt. */
export type SharkStage = 'juvenile' | 'adult';

export interface SharkopediaEntry {
  /** Stable storage id. Never change one of these without migrating what is already saved. */
  id: string;
  name: string;
  stage: SharkStage;
  /** The species whose look and sprite this entry is drawn with. */
  kind: SharkKind;
  /** Whether it is drawn at the large size, which is also how the game spawns it. */
  large: boolean;
  description: string;
  /** Pod needed to ram one, as printed. Absent where ramming is not how it ends. */
  pod?: string;
  /** Set on the two that are not simply a species at a size. */
  special?: 'matriarch' | 'megamouth';
}

/** The id an encounter is recorded under. Also what the view looks up. */
export function entryId(kind: SharkKind, large: boolean): string {
  return `${kind}:${large ? 'adult' : 'juvenile'}`;
}

const SPECIES: { kind: SharkKind; name: string; juvenile: string; adult: string }[] = [
  {
    kind: 'tiger',
    name: 'Tiger Shark',
    juvenile:
      'The first shark anyone meets. Juveniles stay close and hunt in numbers, and four dolphins are enough to see one off - which makes them the shark you learn the pod on.',
    adult:
      'Full-grown tigers freeze in the water and then lunge straight at you. Once the juveniles are gone they also vanish from sight while still hunting, and only reappear when they have fed. Keep moving.',
  },
  {
    kind: 'greatWhite',
    name: 'Great White Shark',
    juvenile:
      'Bigger than a young tiger and harder to shake, but still something a working pod can handle. It tracks you from anywhere in the water rather than losing interest.',
    adult:
      'Enormous, fast, and capable of charging across open water. It takes most of a pod and a Boost dash to bring one down - the shark that teaches you both at once.',
  },
  {
    kind: 'hammerhead',
    name: 'Hammerhead Shark',
    juvenile:
      'Quicker than the others and relentless with it. A hammerhead will follow you off one side of the ocean and come back round the other.',
    adult:
      'Faster again, and it hunts the space rather than the pod: large hammerheads swing wide to come at you from the flank instead of running you down from behind.',
  },
  {
    kind: 'frilled',
    name: 'Frilled Shark',
    juvenile:
      'A long eel of a shark from the twilight water, black as the cookiecutter and lit by two pale points set far apart - the gap between them is the only measure of its size in the dark. Close up you also catch the green of its eye, which means it has seen you. Slower than anything else down there, and it never stops.',
    adult:
      'Longer again, and it strikes. A grown frilled shark swings wide of the pod and then throws its head out along its own length - aimed once, when the strike begins, and anything lying across that line is taken.',
  },
  {
    kind: 'cookiecutter',
    name: 'Cookiecutter Shark',
    juvenile:
      'Small, black and quick, lit only by the green glow of its own belly. One is barely a threat, but it takes five dolphins to see off, and they never travel alone.',
    adult:
      'It picks a single dolphin out of your pod and commits to one run at it. The warning is the whole of the counterplay - the run is aimed once, when the warning ends, and never corrected, so moving the pod off that line is a dodge rather than a delay.',
  },
];

/**
 * Everything in the book, in the order it is shown.
 *
 * Species run juvenile then adult so the two sizes of one animal sit together, in the order the
 * campaign introduces them; the two that are not simply a species at a size come last.
 */
export const SHARKOPEDIA: SharkopediaEntry[] = [
  ...SPECIES.flatMap<SharkopediaEntry>((species) => [
    {
      id: entryId(species.kind, false),
      name: species.name,
      stage: 'juvenile',
      kind: species.kind,
      large: false,
      description: species.juvenile,
      pod: podRequirementLabel(species.kind, false),
    },
    {
      id: entryId(species.kind, true),
      name: species.name,
      stage: 'adult',
      kind: species.kind,
      large: true,
      description: species.adult,
      pod: podRequirementLabel(species.kind, true),
    },
  ]),
  {
    id: 'matriarch',
    name: 'The Matriarch',
    stage: 'adult',
    kind: 'greatWhite',
    large: true,
    special: 'matriarch',
    description:
      'The oldest great white in these waters, and the only shark that has ever had a pod of its own to call on - she summons escorts as she fights and takes two dolphins with every bite. No ordinary pod will finish her: it takes a Mega Pod and three Boost dashes driven home.',
  },
  {
    id: 'megamouth',
    name: 'Megamouth Shark',
    stage: 'adult',
    kind: 'greatWhite',
    large: true,
    special: 'megamouth',
    description:
      'A filter feeder the size of a bus, black as the water it lives in and lit along the underside by a row of its own lights. It has no interest in your pod at all - it holds a heading and crosses, and being where it is going is the entire danger. Corner it as the last thing alive and it stops ignoring you.',
  },
];

/** What an unmet entry shows instead of itself. */
export const UNKNOWN_NAME = '???';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch (e) {
    console.warn('Failed to load the Sharkopedia', e);
    return new Set();
  }
}

function save(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch (e) {
    console.warn('Failed to save the Sharkopedia', e);
  }
}

/** Every entry the player has met, as ids. */
export function encounteredEntries(): Set<string> {
  return load();
}

export function hasEncountered(id: string): boolean {
  return load().has(id);
}

/**
 * Records that one of these has been in the water with the player, and reports whether that was
 * the first time. Unknown ids are ignored rather than stored, so a typo cannot quietly add a
 * page the book has no entry for.
 */
export function recordEncounter(id: string): boolean {
  if (!SHARKOPEDIA.some((entry) => entry.id === id)) return false;
  const ids = load();
  if (ids.has(id)) return false;
  ids.add(id);
  save(ids);
  return true;
}

/** Convenience for the spawner, which thinks in kind-and-size rather than in ids. */
export function recordSharkEncounter(kind: SharkKind, large: boolean): boolean {
  return recordEncounter(entryId(kind, large));
}

/** How much of the book is filled in, for the line under the heading. */
export function encounteredCount(): number {
  const ids = load();
  return SHARKOPEDIA.filter((entry) => ids.has(entry.id)).length;
}

/** Wipes the record. Only for a full profile reset. */
export function clearSharkopedia(): void {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('Failed to clear the Sharkopedia', e);
  }
}
