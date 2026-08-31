import { describe, expect, it } from 'vitest';
import { DOLPHIN_SKINS, skinById } from './skins';

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

  it('has a share-only reward skin', () => {
    const voyager = DOLPHIN_SKINS.find((s) => s.id === 'voyager');
    expect(voyager?.source).toBe('reward');
    expect(voyager?.price).toBe(0);
  });
});

describe('skinById', () => {
  it('falls back to classic for an unknown id', () => {
    expect(skinById('nope').id).toBe('classic');
    expect(skinById('orca').id).toBe('orca');
  });
});
