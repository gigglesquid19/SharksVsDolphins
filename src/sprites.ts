import { AnimatedSprite, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

export type SharkKind = 'greatWhite' | 'hammerhead' | 'tiger';

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

export class SharkFishSprite extends AnimatedSprite {
  private moveTextures: Texture[];
  private attackTextures: Texture[];
  private attacking = false;

  constructor(textures: SharkTextureSet) {
    super(textures.move);
    this.moveTextures = textures.move;
    this.attackTextures = textures.attack;
    this.anchor.set(0.5);
    this.animationSpeed = 0.15;
    this.play();
  }

  setAttacking(attacking: boolean): void {
    if (attacking === this.attacking) return;
    this.attacking = attacking;
    this.textures = attacking ? this.attackTextures : this.moveTextures;
    this.animationSpeed = attacking ? 0.28 : 0.15;
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
  grad.addColorStop(0.44, '#6ba0d6');
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

  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'linear';
  return tex;
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

export function createSharkSprite(textures: SharkTextureSet): SharkFishSprite {
  return new SharkFishSprite(textures);
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
