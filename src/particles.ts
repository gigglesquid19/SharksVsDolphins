import { Container, Texture, Sprite } from 'pixi.js';

export type ParticleType = 'bubble' | 'wake' | 'hit' | 'sparkle';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

function makeSoftCircleTexture(size: number, color: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export class ParticleSystem {
  private container: Container;
  private pool: Particle[] = [];
  private active: Particle[] = [];
  private textures: Record<ParticleType, Texture>;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);

    this.textures = {
      bubble: makeSoftCircleTexture(32, 'rgba(224, 242, 254, 0.65)'),
      wake: makeSoftCircleTexture(24, 'rgba(34, 211, 238, 0.55)'),
      hit: makeSoftCircleTexture(48, 'rgba(248, 113, 113, 0.75)'),
      sparkle: makeSoftCircleTexture(32, 'rgba(250, 204, 21, 0.85)'),
    };
  }

  emit(type: ParticleType, x: number, y: number, count: number, options?: { speed?: number; life?: number }): void {
    const speed = options?.speed ?? 1;
    const life = options?.life ?? 1;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * speed;
      const vx = Math.cos(angle) * spread;
      const vy = Math.sin(angle) * spread;
      this.spawn(type, x, y, vx, vy, 0.5 + Math.random() * life);
    }
  }

  emitDirected(type: ParticleType, x: number, y: number, count: number, dirX: number, dirY: number, options?: { speed?: number; life?: number }): void {
    const speed = options?.speed ?? 1;
    const life = options?.life ?? 1;

    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.2;
      const spread = (0.2 + Math.random() * 0.8) * speed;
      const vx = Math.cos(angle) * spread;
      const vy = Math.sin(angle) * spread;
      this.spawn(type, x, y, vx, vy, 0.3 + Math.random() * life);
    }
  }

  private spawn(type: ParticleType, x: number, y: number, vx: number, vy: number, lifeSeconds: number): void {
    let particle = this.pool.pop();
    if (!particle) {
      const sprite = new Sprite(this.textures[type]);
      sprite.anchor.set(0.5);
      particle = { sprite, vx: 0, vy: 0, life: 0, maxLife: 1, startScale: 1, endScale: 0 };
      this.container.addChild(sprite);
    } else {
      particle.sprite.texture = this.textures[type];
      particle.sprite.visible = true;
    }

    particle.sprite.x = x;
    particle.sprite.y = y;
    particle.sprite.alpha = 1;
    particle.sprite.scale.set(0.5 + Math.random() * 0.5);
    particle.vx = vx;
    particle.vy = vy;
    particle.life = lifeSeconds;
    particle.maxLife = lifeSeconds;
    particle.startScale = particle.sprite.scale.x;
    particle.endScale = 0.1;

    this.active.push(particle);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.sprite.visible = false;
        this.pool.push(p);
        this.active.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife;
      p.sprite.x += p.vx * dt * 60;
      p.sprite.y += p.vy * dt * 60;
      p.sprite.alpha = 1 - t;
      const scale = p.startScale + (p.endScale - p.startScale) * t;
      p.sprite.scale.set(scale);

      if (p.sprite.texture === this.textures.bubble) {
        p.sprite.x += Math.sin(t * Math.PI * 4) * 0.3;
      }
    }
  }

  clear(): void {
    for (const p of this.active) {
      p.sprite.visible = false;
      this.pool.push(p);
    }
    this.active = [];
  }

  destroy(): void {
    for (const p of this.active) {
      p.sprite.destroy();
    }
    for (const p of this.pool) {
      p.sprite.destroy();
    }
    this.active = [];
    this.pool = [];
    this.container.destroy();
  }
}
