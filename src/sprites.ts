import { AnimatedSprite, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

/**
 * Every shark in the water. The first three each have their own animated strip; the last two are
 * drawn from the tiger's, reshaped and recoloured (see SHARK_KIND_LOOK in game.ts), which is how
 * a new species gets added without commissioning a new sprite sheet.
 */
export type SharkKind = 'greatWhite' | 'hammerhead' | 'tiger' | 'frilled' | 'cookiecutter';

export interface SharkTextureSet {
  move: Texture[];
  attack: Texture[];
}

const SHARK_FRAME_SIZE = 64;
const SHARK_FRAME_COUNT = 9;

export function sliceSharkStrip(baseTexture: Texture): Texture[] {
  baseTexture.source.scaleMode = 'nearest';
  const frames: Texture[] = [];
  for (let i = 0; i < SHARK_FRAME_COUNT; i++) {
    frames.push(
      new Texture({
        source: baseTexture.source,
        frame: new Rectangle(i * SHARK_FRAME_SIZE, 0, SHARK_FRAME_SIZE, SHARK_FRAME_SIZE),
      })
    );
  }
  return frames;
}

const SHARK_SWIM_SPEED = 0.15;
const SHARK_ATTACK_SPEED = 0.28;

export class SharkFishSprite extends AnimatedSprite {
  private moveTextures: Texture[];
  private attackTextures: Texture[];
  private attacking = false;
  /**
   * How fast this shark works through its frames, against the stock rate. A species drawn from
   * another one's strip needs it: the same nine frames played slowly read as a long body
   * undulating, and played fast as something small flicking about.
   */
  private readonly speedScale: number;

  constructor(textures: SharkTextureSet, speedScale = 1) {
    super(textures.move);
    this.moveTextures = textures.move;
    this.attackTextures = textures.attack;
    this.speedScale = speedScale;
    this.anchor.set(0.5);
    this.animationSpeed = SHARK_SWIM_SPEED * speedScale;
    this.play();
  }

  setAttacking(attacking: boolean): void {
    if (attacking === this.attacking) return;
    this.attacking = attacking;
    this.textures = attacking ? this.attackTextures : this.moveTextures;
    this.animationSpeed = (attacking ? SHARK_ATTACK_SPEED : SHARK_SWIM_SPEED) * this.speedScale;
    this.gotoAndPlay(0);
  }
}

export interface DolphinPalette {
  /** Dorsal (top) — darkest. */
  back: string;
  mid: string;
  /** Lower flank, just above the belly. */
  flank: string;
  /** Ventral (bottom) — lightest. */
  belly: string;
  /** Dorsal fin, pectoral flipper, and fluke. */
  fin: string;
  /** Fin edge / outline. */
  finEdge: string;
  /** Thin highlight run along the spine. */
  rim: string;
  eye: string;
}

export const DEFAULT_DOLPHIN_PALETTE: DolphinPalette = {
  back: '#1d3149',
  mid: '#4076b6',
  flank: '#93bfe7',
  belly: '#ffffff',
  fin: '#2c5388',
  finEdge: 'rgba(16,28,46,0.4)',
  rim: 'rgba(214,234,255,0.9)',
  eye: '#0a1420',
};

// The static parts of the dolphin (countershaded body, dorsal fin, pectoral, eye) are
// rendered once to a texture and shared by every dolphin sprite - there can be 15+ on
// screen at once during the Mega Pod. Only the fluke is a live Graphics child so it can
// beat; game.ts adds the body arch / bob / bank on top.
const BODY_CANVAS_W = 150;
const BODY_CANVAS_H = 100;
/** Sprite scale that turns the ~75px silhouette into a ~26 world-unit dolphin. */
const BODY_SPRITE_SCALE = 26 / 75;
/** Fluke pivot, in the sprite's local (world-unit) space - the tip of the peduncle. */
const FLUKE_JOINT_X = -38 * BODY_SPRITE_SCALE;

const bodyTextureCache = new Map<string, Texture>();

function makeDolphinBodyTexture(p: DolphinPalette): Texture {
  const tex = Texture.from(makeDolphinBodyCanvas(p));
  tex.source.scaleMode = 'linear';
  return tex;
}

/** Linear blend of two `#rrggbb` colours, `t` from 0 (a) to 1 (b). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * Draws the static dolphin body (countershaded flanks, dorsal fin, pectoral, eye)
 * to a fresh canvas. Used both for the shared sprite texture and, at a larger
 * scale, for the Store's skin previews (src/storeView.ts).
 */
export function makeDolphinBodyCanvas(p: DolphinPalette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BODY_CANVAS_W;
  canvas.height = BODY_CANVAS_H;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(BODY_CANVAS_W / 2, BODY_CANVAS_H / 2);

  // Melon -> back -> peduncle: the top edge, shared by the silhouette and the rim light.
  const topEdge = () => {
    ctx.moveTo(26, -0.5);
    ctx.quadraticCurveTo(19, -11, 9, -10);
    ctx.bezierCurveTo(-5, -9, -17, -6.5, -29, -2);
  };
  // Full silhouette (faces +x): lower jaw and belly forward, then topEdge back over the head.
  const silhouette = () => {
    ctx.beginPath();
    ctx.moveTo(37, 2.5); // rounded beak tip
    ctx.quadraticCurveTo(33, 4.2, 30, 4.6);
    ctx.quadraticCurveTo(24, 6, 16, 7.5); // lower jaw
    ctx.bezierCurveTo(3, 11.3, -15, 10.3, -29, 4); // belly
    ctx.quadraticCurveTo(-34, 2, -38, 0); // peduncle -> fluke joint
    ctx.quadraticCurveTo(-34, -1, -29, -2);
    ctx.bezierCurveTo(-17, -6.5, -5, -9, 9, -10); // back
    ctx.quadraticCurveTo(19, -11, 26, -0.5); // melon
    ctx.quadraticCurveTo(31, 0.8, 37, 2.5);
    ctx.closePath();
  };

  // flat contact shadow, baked so it never banks with the body
  ctx.save();
  ctx.translate(1, 7.5);
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, 33, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2,8,20,0.14)';
  ctx.fill();
  ctx.restore();

  // dorsal fin (falcate) and pectoral flipper - drawn under the body so the bases tuck in
  ctx.fillStyle = p.fin;
  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.bezierCurveTo(3, -24, -10, -21, -13, -9.5);
  ctx.quadraticCurveTo(-5, -8, 4, -7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, 7);
  ctx.quadraticCurveTo(7, 22, -6, 19);
  ctx.quadraticCurveTo(2, 13, 13, 7);
  ctx.closePath();
  ctx.fill();

  // countershaded body, then a rim light clipped to it so the highlight hugs the spine
  const grad = ctx.createLinearGradient(0, -11, 0, 13);
  grad.addColorStop(0, p.back);
  grad.addColorStop(0.24, p.mid);
  grad.addColorStop(0.44, mixHex(p.mid, p.flank, 0.5));
  grad.addColorStop(0.58, p.flank);
  grad.addColorStop(0.72, p.belly);
  grad.addColorStop(1, p.belly);
  silhouette();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(-48, -32, 100, 52);
  ctx.beginPath();
  topEdge();
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // dorsal edge, smile, eye
  ctx.strokeStyle = p.finEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.bezierCurveTo(3, -24, -10, -21, -13, -9.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(31, 4);
  ctx.quadraticCurveTo(24, 6.5, 18, 5.5);
  ctx.strokeStyle = 'rgba(15,28,48,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(21, -2.5, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = p.eye;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21.9, -3.3, 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  return canvas;
}

export function createDolphinSprite(palette: DolphinPalette = DEFAULT_DOLPHIN_PALETTE): Container {
  const container = new Container();

  const key = JSON.stringify(palette);
  let bodyTexture = bodyTextureCache.get(key);
  if (!bodyTexture) {
    bodyTexture = makeDolphinBodyTexture(palette);
    bodyTextureCache.set(key, bodyTexture);
  }

  const body = new Sprite(bodyTexture);
  body.anchor.set(0.5);
  body.scale.set(BODY_SPRITE_SCALE);
  container.addChild(body);

  const tail = new Container();
  tail.position.set(FLUKE_JOINT_X, 0);
  tail.name = 'tail';
  const fluke = new Graphics();
  fluke.moveTo(1, 0);
  fluke.bezierCurveTo(-0.4, -0.6, -1.6, -2.4, -4, -3.4);
  fluke.quadraticCurveTo(-2, -1.2, -2.8, 0);
  fluke.quadraticCurveTo(-2, 1.2, -4, 3.4);
  fluke.bezierCurveTo(-1.6, 2.4, -0.4, 0.6, 1, 0);
  fluke.closePath();
  fluke.fill({ color: cssToHex(palette.fin) });
  fluke.stroke({ width: 0.4, color: 0x142034, alpha: 0.35 });
  tail.addChild(fluke);
  container.addChild(tail);

  return container;
}

function cssToHex(css: string): number {
  if (css.startsWith('#')) return parseInt(css.slice(1, 7), 16);
  return 0x33619e;
}

export function createSharkSprite(textures: SharkTextureSet, speedScale = 1): SharkFishSprite {
  return new SharkFishSprite(textures, speedScale);
}

export interface Photophore {
  /** Position in the shark strip's own 64px frame, centre at 0,0. Positive y is the belly. */
  x: number;
  y: number;
}

/**
 * The row of lights along a deep-water shark's underside: one Graphics per light, positioned by
 * the caller each frame.
 *
 * Each light is its own child rather than all of them being drawn into one shape, because where a
 * light sits and how big it looks have to scale differently. The positions follow the body, so a
 * species stretched into an eel carries its lights spread along it; the lights themselves stay
 * roughly a fixed size on screen, or a cookiecutter a third the size of a tiger would wear one too
 * small to see - and being seen is the entire job.
 *
 * A soft halo, a middle, and a hard core, drawn additively so they read as light in dark water.
 */
/**
 * One full photophore cycle, and the share of it spent flaring rather than resting.
 *
 * The lights used to breathe on a plain sine, which at a distance reads as a steady smudge and
 * sits in with the background. A long rest broken by a short flare reads as something alive
 * instead, and a flare is what carries: it is the change the eye catches in black water, not the
 * brightness.
 */
const PHOTOPHORE_PULSE_PERIOD_MS = 2600;
const PHOTOPHORE_PULSE_FLARE_SHARE = 0.28;
/**
 * The glow held between flares, and the top of the flare itself.
 *
 * The resting floor is high deliberately. A flare that is the only time a shark can be seen makes
 * the rest of the cycle a blind spot, which is worse than no light at all: the point is to be able
 * to follow one across dark water, with the flare drawing the eye back to it rather than being the
 * only chance to find it.
 */
export const PHOTOPHORE_ALPHA_REST = 0.6;
export const PHOTOPHORE_ALPHA_PEAK = 1;

/**
 * Alpha for a shark's lights at `nowMs`, resting for most of the cycle and flaring briefly.
 *
 * `seed` offsets each shark around the cycle - pass the shark's id - so a group never flares in
 * unison. The offset is stepped by the golden ratio, which spreads consecutive ids across the
 * period instead of clustering them the way a plain `id * k` does once k divides into the run.
 */
export function photophorePulseAlpha(nowMs: number, seed = 0): number {
  const offset = (seed * 0.618033988749895) % 1;
  const phase = (((nowMs / PHOTOPHORE_PULSE_PERIOD_MS + offset) % 1) + 1) % 1;
  if (phase >= PHOTOPHORE_PULSE_FLARE_SHARE) return PHOTOPHORE_ALPHA_REST;
  // A half sine over the flare: rest -> peak -> rest, with no corner at either end.
  const envelope = Math.sin((phase / PHOTOPHORE_PULSE_FLARE_SHARE) * Math.PI);
  return PHOTOPHORE_ALPHA_REST + (PHOTOPHORE_ALPHA_PEAK - PHOTOPHORE_ALPHA_REST) * envelope;
}

export function createPhotophores(spots: Photophore[], color: number): Container {
  const group = new Container();
  for (let i = 0; i < spots.length; i++) {
    const dot = new Graphics();
    // Bigger than a light this bright needs to be, because at distance it is competing with a
    // whole screen: a 2px point is lost among the drifting motes, while a soft disc this size
    // reads as a light source from across the arena. The halo does most of that work - the core
    // only has to keep it from looking like a smudge.
    dot.circle(0, 0, 12).fill({ color, alpha: 0.2 });
    dot.circle(0, 0, 6).fill({ color, alpha: 0.5 });
    dot.circle(0, 0, 2.6).fill({ color, alpha: 1 });
    dot.blendMode = 'add';
    group.addChild(dot);
  }
  return group;
}

/**
 * A plain eye, not a lamp.
 *
 * Deliberately none of what createPhotophores does: no halo, no additive blend, no glow. A
 * photophore is an organ a species lights the water with and can be read from across the arena;
 * this is just an eye catching what little light there is, from close up. Same dot shape so the
 * two sit consistently on the sprite, and that is the end of the resemblance.
 */
export function createEyes(spots: Photophore[], color: number): Container {
  const group = new Container();
  for (let i = 0; i < spots.length; i++) {
    const dot = new Graphics();
    dot.circle(0, 0, 2.2).fill({ color, alpha: 1 });
    group.addChild(dot);
  }
  return group;
}

/**
 * One point down the length of an arm: where it is, and how thick it is there.
 */
interface TentaclePoint {
  x: number;
  y: number;
  w: number;
}

const TENTACLE_SEGMENTS = 22;
/**
 * Thick at the root, and swinging a long way at the tip.
 *
 * Both were about a third of this to begin with, which drew something closer to a ribbon than an
 * arm: at a couple of hundred pixels long a 13px root is a band, and a 16px swing over that
 * distance is a straight line with a kink. An arm has to be visibly heavy where it meets the dark
 * and visibly loose at the end.
 *
 * The two are raised together and with the reach, so the arm keeps its proportions as it grows -
 * a longer arm at the old thickness would go back to being a ribbon. TENTACLE_HIT_RADIUS in
 * game.ts is part of the same set and moves with them.
 */
const TENTACLE_ROOT_WIDTH = 36;
const TENTACLE_WAVE_PX = 51;

/**
 * The shape of an arm at this instant, shared by the body and its lights.
 *
 * Computed once and handed to both so the two can never disagree about where the arm is - they
 * are drawn into different layers, on opposite sides of the gloom, and nothing else ties them
 * together.
 */
function tentaclePoints(lengthPx: number, dir: -1 | 1, t: number, phase: number): TentaclePoint[] {
  const points: TentaclePoint[] = [];
  for (let i = 0; i <= TENTACLE_SEGMENTS; i++) {
    const along = i / TENTACLE_SEGMENTS;
    const x = dir * lengthPx * along;
    // The wave grows along the arm and travels outward, so the tip writhes and the root holds.
    const y = Math.sin(t * 2.2 - along * 3.4 + phase) * TENTACLE_WAVE_PX * along * along;
    // A gentler taper than linear, so it stays fleshy most of the way out and only draws to a
    // point near the tip - taper too hard and the far half is a hair rather than an arm.
    points.push({ x, y, w: TENTACLE_ROOT_WIDTH * (1 - along ** 1.9) ** 0.7 });
  }
  return points;
}

/**
 * Draws the meat of one kraken arm, from the edge to wherever it has reached.
 *
 * Redrawn every frame rather than being a sprite, because the thing that makes a tentacle read as
 * a tentacle is that its length and its curl both change continuously - there is no single picture
 * of it to hold.
 *
 * This half lives *under* the gloom, so at depth the arm is a shape you half-see rather than a lit
 * object. What actually tells you where it is are its lights, drawn separately above the gloom by
 * drawTentacleLights - the same bargain every deep-water shark down here strikes.
 *
 * @param lengthPx how far it currently reaches, in pixels
 * @param dir      -1 reaching leftward, 1 rightward
 * @param t        seconds, for the travelling wave
 * @param phase    this arm's own wave offset, so a pair never curls in step
 * @param menace   0 while it is only telegraphing, 1 once it can take a dolphin
 */
export function drawTentacle(
  g: Graphics,
  lengthPx: number,
  dir: -1 | 1,
  t: number,
  phase: number,
  menace: number,
): void {
  g.clear();
  if (lengthPx <= 1) return;
  const points = tentaclePoints(lengthPx, dir, t, phase);

  // One closed outline down one side of the chain and back up the other, so the taper is a shape
  // rather than a stroke that cannot change width.
  g.moveTo(points[0].x, points[0].y - points[0].w);
  for (const p of points) g.lineTo(p.x, p.y - p.w);
  for (let i = points.length - 1; i >= 0; i--) g.lineTo(points[i].x, points[i].y + points[i].w);
  g.closePath();
  g.fill({ color: 0x4a2560, alpha: 0.82 + 0.18 * menace });
  g.stroke({ width: 2, color: 0x7c3aed, alpha: 0.4 + 0.3 * menace });
}

/**
 * The arm's photophores: the row of suckers along its underside, lit.
 *
 * Drawn into the lights layer above the gloom, so they carry through the dark the way a frilled
 * shark's pair does. They are the whole of the arm's tell at depth, which is why they brighten
 * with menace - a telegraphing arm glows faintly, one that can take a dolphin glows properly.
 */
export function drawTentacleLights(
  g: Graphics,
  lengthPx: number,
  dir: -1 | 1,
  t: number,
  phase: number,
  menace: number,
): void {
  g.clear();
  if (lengthPx <= 1) return;
  const points = tentaclePoints(lengthPx, dir, t, phase);

  for (let i = 2; i < TENTACLE_SEGMENTS; i += 2) {
    const p = points[i];
    const r = Math.max(1.1, p.w * 0.26);
    const cx = p.x;
    const cy = p.y + p.w * 0.35;
    // Halo, middle, core - the same three-layer build the sharks' photophores use, drawn
    // additively so they read as light in water rather than as paint on it.
    g.circle(cx, cy, r * 3.2).fill({ color: 0xd8b4fe, alpha: (0.1 + 0.12 * menace) });
    g.circle(cx, cy, r * 1.7).fill({ color: 0xe9d5ff, alpha: (0.28 + 0.3 * menace) });
    g.circle(cx, cy, r).fill({ color: 0xfdf4ff, alpha: (0.6 + 0.4 * menace) });
  }
  g.blendMode = 'add';
}

export function makeRadialGradientTexture(size: number, color: string): Texture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/**
 * The fraction of the vignette texture's radius that is left completely clear. Exported so the
 * caller can size the sprite from the lit radius it actually wants: a clear circle of R pixels
 * needs the sprite drawn 2R / VIGNETTE_CLEAR_FRACTION across.
 */
export const VIGNETTE_CLEAR_FRACTION = 0.1;
const VIGNETTE_SOLID_FRACTION = 0.17;

/**
 * A darkness with a hole in the middle: clear at the centre, solid `color` from a short way out
 * to the edge. Laid over the scene and parked on the dolphin, it is the light the pod has left
 * at depth - everything past arm's reach goes black, which is what the deep zones need and what
 * makes Echolocation the only way to see.
 *
 * Drawn mostly solid rather than as a soft falloff so that one sprite, scaled up, still covers
 * the whole canvas however close to a corner the player swims.
 */
export function makeVignetteTexture(size: number, color: string): Texture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(VIGNETTE_CLEAR_FRACTION, 'rgba(0,0,0,0)');
  grad.addColorStop(VIGNETTE_SOLID_FRACTION, color);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

export function createJellyfishSprite(): Container {
  const container = new Container();

  const bell = new Graphics();
  bell.ellipse(0, -4, 7, 5);
  bell.fill({ color: 0xc084fc, alpha: 0.8 });
  bell.stroke({ width: 1, color: 0x7e22ce, alpha: 0.9 });
  container.addChild(bell);

  const tentacles = new Graphics();
  tentacles.moveTo(-4, -2);
  tentacles.lineTo(-5, 7);
  tentacles.moveTo(0, -1);
  tentacles.lineTo(0, 8);
  tentacles.moveTo(4, -2);
  tentacles.lineTo(5, 7);
  tentacles.stroke({ width: 1.2, color: 0xe9d5ff, alpha: 0.7 });
  container.addChild(tentacles);

  const glow = new Graphics();
  glow.ellipse(0, -4, 9, 7);
  glow.fill({ color: 0xc084fc, alpha: 0.2 });
  container.addChild(glow);

  return container;
}
