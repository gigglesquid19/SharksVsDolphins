import { describe, expect, it } from 'vitest';
import { DOLPHIN_SKINS, NATION_SKIN_PRICE, skinById } from './skins';
import { SHARE_REWARD_SKIN } from './share';

const PALETTE_KEYS = ['back', 'mid', 'flank', 'belly', 'fin', 'finEdge', 'rim', 'eye'] as const;

describe('DOLPHIN_SKINS', () => {
  it('has classic first, free', () => {
    expect(DOLPHIN_SKINS[0].id).toBe('classic');
    expect(DOLPHIN_SKINS[0].price).toBe(0);
  });

  it('gives every skin a unique id and a full palette', () => {
    const ids = DOLPHIN_SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const skin of DOLPHIN_SKINS) {
      for (const key of PALETTE_KEYS) {
        expect(typeof skin.palette[key], `${skin.id}.${key}`).toBe('string');
      }
    }
  });

  it('prices every store skin except classic above zero', () => {
    for (const skin of DOLPHIN_SKINS) {
      if (skin.id === 'classic' || skin.source === 'reward') continue;
      expect(skin.source).toBe('store');
      expect(skin.price).toBeGreaterThan(0);
    }
  });

  it('marks exactly one skin as the share-only reward, and it is the one share.ts grants', () => {
    const rewards = DOLPHIN_SKINS.filter((s) => s.source === 'reward');
    expect(rewards).toHaveLength(1);
    expect(rewards[0].id).toBe(SHARE_REWARD_SKIN);
    expect(rewards[0].price).toBe(0);
  });
});

describe('skinById', () => {
  it('falls back to classic for an unknown id', () => {
    expect(skinById('nope').id).toBe('classic');
    expect(skinById('orca').id).toBe('orca');
  });
});

describe('national skins', () => {
  const nations = DOLPHIN_SKINS.filter((s) => s.group === 'nation');

  it('covers twenty countries', () => {
    expect(nations).toHaveLength(20);
  });

  it('charges the same for every country', () => {
    for (const skin of nations) expect(skin.price).toBe(NATION_SKIN_PRICE);
  });

  it('sells them all rather than gating any behind a reward', () => {
    for (const skin of nations) expect(skin.source).toBe('store');
  });

  it('keeps the original skins on their own shelf', () => {
    const ocean = DOLPHIN_SKINS.filter((s) => s.group === 'ocean');
    expect(ocean.map((s) => s.id)).toContain('classic');
    expect(ocean.map((s) => s.id)).toContain(SHARE_REWARD_SKIN);
    expect(ocean.length + nations.length).toBe(DOLPHIN_SKINS.length);
  });

  it('gives each country a distinct palette', () => {
    const seen = new Set(nations.map((s) => JSON.stringify(s.palette)));
    expect(seen.size).toBe(nations.length);
  });
});
