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
  /**
   * Which shelf of the Store the skin sits on. The nations set is large enough that mixing it
   * into the original list would bury those behind twenty flags.
   */
  group: 'ocean' | 'nation';
  palette: DolphinPalette;
}

/**
 * Every national skin costs the same. Pricing them differently would amount to ranking the
 * countries against each other, and there is no version of that worth the Pearls it earns.
 */
export const NATION_SKIN_PRICE = 220;

export const DOLPHIN_SKINS: DolphinSkin[] = [
  { id: 'classic', name: 'Classic Blue', price: 0, source: 'store', group: 'ocean', palette: DEFAULT_DOLPHIN_PALETTE },
  {
    id: 'reef',
    name: 'Reef Green',
    price: 180,
    source: 'store',
    group: 'ocean',
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
    group: 'ocean',
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
    // Not for sale - earned by sharing a milestone (see src/share.ts / SHARE_REWARD_SKIN).
    id: 'orca',
    name: 'Orca',
    price: 0,
    source: 'reward',
    group: 'ocean',
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
    group: 'ocean',
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
    group: 'ocean',
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
    group: 'ocean',
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
    id: 'voyager',
    name: 'Voyager',
    price: 240,
    source: 'store',
    group: 'ocean',
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

/**
 * One skin per country, for the twenty largest mobile gaming markets by players and revenue.
 * Each is the national colours read onto the dolphin's own countershading - the darkest band
 * along the back, the lightest at the belly - rather than a flag pasted on a fish, so a pod
 * still looks like dolphins from across the water.
 */
const NATION_SKINS: DolphinSkin[] = [
  {
    id: 'china',
    name: 'China',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#5c0a10',
      mid: '#c1121f',
      flank: '#e23b3b',
      belly: '#f6a8a8',
      fin: '#ffde00',
      finEdge: 'rgba(40,4,6,0.45)',
      rim: 'rgba(255,224,120,0.95)',
      eye: '#2a0508',
    },
  },
  {
    id: 'usa',
    name: 'United States',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#1b2a5e',
      mid: '#b22234',
      flank: '#f2f4fb',
      belly: '#ffffff',
      fin: '#1b2a5e',
      finEdge: 'rgba(16,22,58,0.45)',
      rim: 'rgba(255,255,255,0.92)',
      eye: '#0d1330',
    },
  },
  {
    id: 'japan',
    name: 'Japan',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#b3122c',
      mid: '#e8e9ec',
      flank: '#fafafa',
      belly: '#ffffff',
      fin: '#c8102e',
      finEdge: 'rgba(90,10,20,0.4)',
      rim: 'rgba(255,210,215,0.9)',
      eye: '#2b0a10',
    },
  },
  {
    id: 'korea',
    name: 'South Korea',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#101828',
      mid: '#2b56b0',
      flank: '#f3f5f8',
      belly: '#ffffff',
      fin: '#cd2e3a',
      finEdge: 'rgba(10,14,28,0.45)',
      rim: 'rgba(255,255,255,0.9)',
      eye: '#0b1020',
    },
  },
  {
    id: 'india',
    name: 'India',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#e07b17',
      mid: '#ff9933',
      flank: '#f6f6f2',
      belly: '#e9f5ea',
      fin: '#138808',
      finEdge: 'rgba(70,40,8,0.4)',
      rim: 'rgba(255,232,196,0.95)',
      eye: '#000080',
    },
  },
  {
    id: 'brazil',
    name: 'Brazil',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#0b4d2c',
      mid: '#1e9e56',
      flank: '#ffdf00',
      belly: '#2a4fa8',
      fin: '#0b4d2c',
      finEdge: 'rgba(6,30,18,0.45)',
      rim: 'rgba(255,247,180,0.9)',
      eye: '#041a3a',
    },
  },
  {
    id: 'indonesia',
    name: 'Indonesia',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#8e0d1a',
      mid: '#c8202c',
      flank: '#f8fafc',
      belly: '#ffffff',
      fin: '#e8323f',
      finEdge: 'rgba(60,6,10,0.4)',
      rim: 'rgba(255,225,225,0.9)',
      eye: '#2a060a',
    },
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#0b1f45',
      mid: '#1e3a7a',
      flank: '#eef2fa',
      belly: '#ffffff',
      fin: '#c8102e',
      finEdge: 'rgba(8,18,44,0.45)',
      rim: 'rgba(255,255,255,0.92)',
      eye: '#0a1226',
    },
  },
  {
    id: 'germany',
    name: 'Germany',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#0e0e10',
      mid: '#b81b23',
      flank: '#ffcc00',
      belly: '#ffe9a8',
      fin: '#1c1c1f',
      finEdge: 'rgba(0,0,0,0.5)',
      rim: 'rgba(255,226,140,0.9)',
      eye: '#0a0a0c',
    },
  },
  {
    id: 'france',
    name: 'France',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#16357f',
      mid: '#3b6fe0',
      flank: '#ffffff',
      belly: '#ffffff',
      fin: '#ef4135',
      finEdge: 'rgba(10,20,58,0.45)',
      rim: 'rgba(226,238,255,0.95)',
      eye: '#0a1030',
    },
  },
  {
    id: 'mexico',
    name: 'Mexico',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#0a4d2e',
      mid: '#1a8a4f',
      flank: '#f4f7f4',
      belly: '#ffffff',
      fin: '#ce1126',
      finEdge: 'rgba(6,32,18,0.45)',
      rim: 'rgba(255,240,235,0.9)',
      eye: '#101a12',
    },
  },
  {
    id: 'turkey',
    name: 'Turkey',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#7d0c17',
      mid: '#b81420',
      flank: '#e03a44',
      belly: '#ffd7da',
      fin: '#ffffff',
      finEdge: 'rgba(50,4,8,0.45)',
      rim: 'rgba(255,255,255,0.95)',
      eye: '#240407',
    },
  },
  {
    id: 'russia',
    name: 'Russia',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#dfe6f2',
      mid: '#2b5fc0',
      flank: '#d9382c',
      belly: '#f3c9c4',
      fin: '#2b5fc0',
      finEdge: 'rgba(20,32,70,0.4)',
      rim: 'rgba(255,255,255,0.9)',
      eye: '#0b1436',
    },
  },
  {
    id: 'vietnam',
    name: 'Vietnam',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#7a0c12',
      mid: '#c81c19',
      flank: '#da251d',
      belly: '#ffcd00',
      fin: '#da251d',
      finEdge: 'rgba(50,6,8,0.45)',
      rim: 'rgba(255,224,120,0.95)',
      eye: '#2a0508',
    },
  },
  {
    id: 'philippines',
    name: 'Philippines',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#062a7a',
      mid: '#1c4fb8',
      flank: '#fcd116',
      belly: '#fff6d0',
      fin: '#ce1126',
      finEdge: 'rgba(4,16,50,0.45)',
      rim: 'rgba(255,240,190,0.9)',
      eye: '#0a1230',
    },
  },
  {
    id: 'thailand',
    name: 'Thailand',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#a51931',
      mid: '#eef1f7',
      flank: '#2d4a8f',
      belly: '#dbe3f2',
      fin: '#a51931',
      finEdge: 'rgba(40,8,16,0.45)',
      rim: 'rgba(255,236,238,0.9)',
      eye: '#0b1024',
    },
  },
  {
    id: 'canada',
    name: 'Canada',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#d52b1e',
      mid: '#f0554a',
      flank: '#ffffff',
      belly: '#ffffff',
      fin: '#b3141f',
      finEdge: 'rgba(80,10,12,0.4)',
      rim: 'rgba(255,232,230,0.95)',
      eye: '#2a0508',
    },
  },
  {
    id: 'italy',
    name: 'Italy',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#1b7a43',
      mid: '#3fae68',
      flank: '#ce2b37',
      belly: '#f6c9ce',
      fin: '#f2f7f2',
      finEdge: 'rgba(8,40,22,0.45)',
      rim: 'rgba(240,255,244,0.95)',
      eye: '#0e1c12',
    },
  },
  {
    id: 'spain',
    name: 'Spain',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#aa151b',
      mid: '#f1bf00',
      flank: '#f7d94c',
      belly: '#ffe9a8',
      fin: '#aa151b',
      finEdge: 'rgba(60,8,10,0.45)',
      rim: 'rgba(255,236,168,0.9)',
      eye: '#2a0608',
    },
  },
  {
    id: 'australia',
    name: 'Australia',
    price: NATION_SKIN_PRICE,
    source: 'store',
    group: 'nation',
    palette: {
      back: '#0a3a22',
      mid: '#157f3c',
      flank: '#ffcd00',
      belly: '#fff3c4',
      fin: '#0c5c2e',
      finEdge: 'rgba(6,26,14,0.45)',
      rim: 'rgba(255,240,180,0.9)',
      eye: '#08200f',
    },
  },
];

DOLPHIN_SKINS.push(...NATION_SKINS);

const DEFAULT_SKIN = DOLPHIN_SKINS[0];

/** The skin with this id, or `classic` if the id is unknown. */
export function skinById(id: string): DolphinSkin {
  return DOLPHIN_SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}
