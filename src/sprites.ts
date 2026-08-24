import { AnimatedSprite, Container, Graphics, Rectangle, Texture } from 'pixi.js';

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

export function createDolphinSprite(): Container {
  const container = new Container();

  const bodyColor = 0x60a5fa;
  const bellyColor = 0xdbeafe;
  const finColor = 0x3b82f6;
  const outline = 0x1e3a8a;

  const body = new Graphics();
  body.ellipse(0, 0, 12, 5.5);
  body.fill({ color: bodyColor });
  body.ellipse(0, 2, 8, 3);
  body.fill({ color: bellyColor });

  body.moveTo(9, -2);
  body.lineTo(15, 0);
  body.lineTo(9, 2);
  body.closePath();
  body.fill({ color: bodyColor });
  container.addChild(body);

  const dorsal = new Graphics();
  dorsal.moveTo(0, 0);
  dorsal.lineTo(2, -7);
  dorsal.lineTo(-4, -5);
  dorsal.closePath();
  dorsal.fill({ color: finColor });
  dorsal.stroke({ width: 0.5, color: outline });
  dorsal.position.set(-3, -5);
  container.addChild(dorsal);

  const pectoral = new Graphics();
  pectoral.moveTo(0, 0);
  pectoral.lineTo(5, 5);
  pectoral.lineTo(-2, 3);
  pectoral.closePath();
  pectoral.fill({ color: finColor });
  pectoral.stroke({ width: 0.5, color: outline });
  pectoral.position.set(4, 3);
  container.addChild(pectoral);

  const tail = new Container();
  tail.position.set(-11, 0);
  const tailGfx = new Graphics();
  tailGfx.moveTo(0, 0);
  tailGfx.lineTo(-7, -5);
  tailGfx.lineTo(-10, -2);
  tailGfx.lineTo(-7, 0);
  tailGfx.lineTo(-10, 2);
  tailGfx.lineTo(-7, 5);
  tailGfx.closePath();
  tailGfx.fill({ color: finColor });
  tailGfx.stroke({ width: 0.5, color: outline });
  tail.addChild(tailGfx);
  tail.name = 'tail';
  container.addChild(tail);

  const eye = new Graphics();
  eye.circle(7, -2, 1.2);
  eye.fill({ color: 0x020617 });
  eye.circle(7.3, -2.3, 0.4);
  eye.fill({ color: 0xffffff });
  container.addChild(eye);

  return container;
}

export function createSharkSprite(textures: SharkTextureSet): SharkFishSprite {
  return new SharkFishSprite(textures);
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
