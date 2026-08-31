import { DEFAULT_DOLPHIN_PALETTE, DolphinPalette } from './sprites';

/**
 * Dolphin skins are pure palette swaps of the procedurally drawn dolphin body
 * (see makeDolphinBodyCanvas in src/sprites.ts) - no new art. One skin is
 * equipped at a time and applies to the whole pod. Ownership / equip state and
 * prices live in src/store.ts; this file is just the catalogue.
 */
export interface DolphinSkin {
  id: string;
  name: string;
  /** Pearl cost. `classic` is 0 and owned from the start; `reward` skins are also 0 but not for sale. */
  price: number;
  /** `store` skins are bought with Pearls; `reward` skins are earned (e.g. by sharing a milestone). */
  source: 'store' | 'reward';
  palette: DolphinPalette;
}

export const DOLPHIN_SKINS: DolphinSkin[] = [
  { id: 'classic', name: 'Classic Blue', price: 0, source: 'store', palette: DEFAULT_DOLPHIN_PALETTE },
  {
    id: 'reef',
    name: 'Reef Green',
    price: 180,
    source: 'store',
    palette: {
      back: '#123f38',
      mid: '#2f8f7a',
      flank: '#8fd8bf',
      belly: '#f2fff6',
      fin: '#1e6b5c',
      finEdge: 'rgba(10,32,28,0.4)',
      rim: 'rgba(210,255,238,0.9)',
      eye: '#08201c',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    price: 200,
    source: 'store',
    palette: {
      back: '#4a1d3d',
      mid: '#b6408f',
      flank: '#e7a6cf',
      belly: '#ffffff',
      fin: '#7a2c63',
      finEdge: 'rgba(40,16,32,0.4)',
      rim: 'rgba(255,224,244,0.9)',
      eye: '#20101c',
    },
  },
  {
    id: 'orca',
    name: 'Orca',
    price: 240,
    source: 'store',
    palette: {
      back: '#0e1013',
      mid: '#20242b',
      flank: '#5b6470',
      belly: '#ffffff',
      fin: '#14171c',
      finEdge: 'rgba(0,0,0,0.5)',
      rim: 'rgba(210,220,235,0.85)',
      eye: '#000000',
    },
  },
  {
    id: 'albino',
    name: 'Albino',
    price: 280,
    source: 'store',
    palette: {
      back: '#c9b8bd',
      mid: '#ddccd0',
      flank: '#efe4e6',
      belly: '#ffffff',
      fin: '#c0aeb4',
      finEdge: 'rgba(120,90,100,0.35)',
      rim: 'rgba(255,245,248,0.9)',
      eye: '#b23b53',
    },
  },
  {
    id: 'gold',
    name: 'Golden',
    price: 320,
    source: 'store',
    palette: {
      back: '#5a3410',
      mid: '#b3792a',
      flank: '#e7c479',
      belly: '#fff4d6',
      fin: '#7d4f18',
      finEdge: 'rgba(40,26,10,0.4)',
      rim: 'rgba(255,240,210,0.9)',
      eye: '#241405',
    },
  },
  {
    id: 'shadow',
    name: 'Abyssal',
    price: 380,
    source: 'store',
    palette: {
      back: '#0b0e1a',
      mid: '#232a44',
      flank: '#3a3f63',
      belly: '#5b5f82',
      fin: '#151a2e',
      finEdge: 'rgba(0,0,0,0.5)',
      rim: 'rgba(120,130,180,0.5)',
      eye: '#0a1420',
    },
  },
  {
    // Not for sale - earned by sharing a milestone (see src/share.ts / SHARE_REWARD_SKIN).
    id: 'voyager',
    name: 'Voyager',
    price: 0,
    source: 'reward',
    palette: {
      back: '#1a2f6b',
      mid: '#3f5fd0',
      flank: '#5fd0e6',
      belly: '#eafcff',
      fin: '#2a3f8f',
      finEdge: 'rgba(12,20,44,0.45)',
      rim: 'rgba(180,255,255,0.95)',
      eye: '#0a1420',
    },
  },
];

const DEFAULT_SKIN = DOLPHIN_SKINS[0];

/** The skin with this id, or `classic` if the id is unknown. */
export function skinById(id: string): DolphinSkin {
  return DOLPHIN_SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}
