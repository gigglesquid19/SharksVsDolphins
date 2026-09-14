import { beforeEach, describe, expect, it } from 'vitest';
import {
  SHARKOPEDIA,
  clearSharkopedia,
  encounteredCount,
  encounteredEntries,
  entryId,
  hasEncountered,
  recordEncounter,
  recordSharkEncounter,
} from './sharkopedia';
import { GREAT_WHITE_EASED_UNTIL_LEVEL, podRequirement, podRequirementLabel } from './sharks';
import type { SharkKind } from './sprites';

const KINDS: SharkKind[] = ['tiger', 'greatWhite', 'hammerhead', 'frilled', 'cookiecutter'];

describe('the Sharkopedia roster', () => {
  it('carries a juvenile and an adult for every species in the game', () => {
    for (const kind of KINDS) {
      expect(SHARKOPEDIA.some((e) => e.id === entryId(kind, false))).toBe(true);
      expect(SHARKOPEDIA.some((e) => e.id === entryId(kind, true))).toBe(true);
    }
  });

  it('includes the two that are not simply a species at a size', () => {
    expect(SHARKOPEDIA.find((e) => e.id === 'matriarch')?.special).toBe('matriarch');
    expect(SHARKOPEDIA.find((e) => e.id === 'megamouth')?.special).toBe('megamouth');
  });

  it('has no duplicate ids, since an id is what an encounter is stored under', () => {
    const ids = SHARKOPEDIA.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry something to read', () => {
    for (const entry of SHARKOPEDIA) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(20);
    }
  });

  it('keeps each species together, juvenile before adult', () => {
    for (const kind of KINDS) {
      const juvenile = SHARKOPEDIA.findIndex((e) => e.id === entryId(kind, false));
      const adult = SHARKOPEDIA.findIndex((e) => e.id === entryId(kind, true));
      expect(adult).toBe(juvenile + 1);
    }
  });

  it('prints the pod requirement the game actually enforces', () => {
    for (const entry of SHARKOPEDIA) {
      if (entry.special || !entry.pod) continue;
      expect(entry.pod).toBe(podRequirementLabel(entry.kind, entry.large));
      // A plain number must match the rule at any depth; a range is the great white's alone.
      if (!entry.pod.includes('-')) {
        expect(podRequirement(entry.kind, entry.large, 1)).toBe(Number(entry.pod));
        expect(podRequirement(entry.kind, entry.large, 20)).toBe(Number(entry.pod));
      }
    }
  });

  it('shows the large great white as a range, because it really is one', () => {
    const entry = SHARKOPEDIA.find((e) => e.id === entryId('greatWhite', true));
    expect(entry?.pod).toBe('10-12');
    expect(podRequirement('greatWhite', true, GREAT_WHITE_EASED_UNTIL_LEVEL)).toBe(10);
    expect(podRequirement('greatWhite', true, GREAT_WHITE_EASED_UNTIL_LEVEL + 1)).toBe(12);
  });

  it('never asks less of an adult than of its own juvenile', () => {
    for (const kind of KINDS) {
      expect(podRequirement(kind, true, 20)).toBeGreaterThanOrEqual(podRequirement(kind, false, 20));
    }
  });
});

describe('what the player has met', () => {
  beforeEach(() => {
    clearSharkopedia();
  });

  it('starts empty, so a new player opens an entirely shadowed book', () => {
    expect(encounteredEntries().size).toBe(0);
    expect(encounteredCount()).toBe(0);
    for (const entry of SHARKOPEDIA) expect(hasEncountered(entry.id)).toBe(false);
  });

  it('records an encounter and remembers it', () => {
    expect(recordSharkEncounter('tiger', false)).toBe(true);
    expect(hasEncountered(entryId('tiger', false))).toBe(true);
    expect(encounteredCount()).toBe(1);
  });

  it('reports only the first sighting as new, so nothing fires twice', () => {
    expect(recordSharkEncounter('hammerhead', true)).toBe(true);
    expect(recordSharkEncounter('hammerhead', true)).toBe(false);
    expect(encounteredCount()).toBe(1);
  });

  it('keeps the two sizes of one species apart', () => {
    recordSharkEncounter('tiger', false);
    expect(hasEncountered(entryId('tiger', false))).toBe(true);
    expect(hasEncountered(entryId('tiger', true))).toBe(false);
  });

  it('takes the specials by id', () => {
    expect(recordEncounter('matriarch')).toBe(true);
    expect(hasEncountered('matriarch')).toBe(true);
    expect(hasEncountered('megamouth')).toBe(false);
  });

  it('ignores an id the book has no page for', () => {
    expect(recordEncounter('kraken')).toBe(false);
    expect(encounteredEntries().size).toBe(0);
  });

  it('survives being read back from storage rather than from memory', () => {
    recordSharkEncounter('frilled', false);
    recordEncounter('megamouth');
    // Nothing is cached between calls, so this is a genuine round trip through localStorage.
    expect([...encounteredEntries()].sort()).toEqual(['frilled:juvenile', 'megamouth']);
  });

  it('fills up to exactly the roster and no further', () => {
    for (const entry of SHARKOPEDIA) recordEncounter(entry.id);
    expect(encounteredCount()).toBe(SHARKOPEDIA.length);
    for (const entry of SHARKOPEDIA) expect(recordEncounter(entry.id)).toBe(false);
  });

  it('shrugs off a corrupted record rather than taking the menu down with it', () => {
    localStorage.setItem('svsd-sharkopedia', '{"not":"an array"}');
    expect(encounteredEntries().size).toBe(0);
    expect(recordSharkEncounter('tiger', false)).toBe(true);
  });
});
