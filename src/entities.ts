import { CANVAS_SIZE, SIZE } from './constants';
import { clampEntityY, clampX, directionDelta, wrapX } from './utils';
import type { SharkKind } from './sprites';

const CHARGE_DURATION = 1000;
const CHARGE_COOLDOWN = 5000;
const CHARGE_SPEED = 2;
const CHARGE_MIN_DIST = 5;
const CHARGE_MAX_DIST = 30;
const AMBUSH_STALK_DURATION = 1200;
const AMBUSH_LUNGE_DURATION = 1200;
const AMBUSH_COOLDOWN = 3000;
const AMBUSH_RANGE = 25;
const AMBUSH_MIN_DIST = 2;
const AMBUSH_SPEED = 3;

export class Dolphin {
  id: number;
  _x: number;
  _y: number;
  lastX: number;
  lastY: number;
  isPlayer = false;
  recruited = false;
  speedBoostUntil = 0;
  invulnerableUntil = 0;
  // Persistent unit heading, eased toward the desired direction so a pod member banks into a
  // turn instead of snapping to it (see Game.moveTowards). 0,0 until it first moves.
  headingX = 0;
  headingY = 0;

  constructor(i: number, y: number, x: number) {
    this.id = i;
    this._x = x;
    this._y = y;
    this.lastX = x;
    this.lastY = y;
  }

  distanceBetween(other: { _x: number; _y: number }): number {
    return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2);
  }

  move(sharks: Shark[]): void {
    if (this.isPlayer || this.recruited) return;

    const avoidRadius = 20;
    let nearestShark: Shark | null = null;
    let nearestDist = Infinity;
    for (const shark of sharks) {
      const d = this.distanceBetween(shark);
      if (d < nearestDist) {
        nearestDist = d;
        nearestShark = shark;
      }
    }

    if (nearestShark && nearestDist <= avoidRadius) {
      const dx = Math.sign(this._x - nearestShark._x) || (Math.random() < 0.5 ? 1 : -1);
      const dy = Math.sign(this._y - nearestShark._y) || (Math.random() < 0.5 ? 1 : -1);
      this._x = wrapX(this._x + dx * 2);
      this._y = clampEntityY(this._y + dy * 2, 2);
    } else {
      if (Math.random() < 0.33) this._y = clampEntityY(this._y + 1, 2);
      else this._y = clampEntityY(this._y - 1, 2);

      if (Math.random() < 0.33) this._x = wrapX(this._x + 1);
      else this._x = wrapX(this._x - 1);
    }
  }
}

export class Shark {
  id: number;
  _x: number;
  _y: number;
  lastX: number;
  lastY: number;
  sizeMultiplier = 1;
  speedMultiplier = 1;
  large = false;
  matriarch = false;
  kind: SharkKind;
  charging = false;
  chargeEndTime = 0;
  chargeCooldownEnd = 0;
  chargeDx = 0;
  chargeDy = 0;
  ambushing = false;
  stalking = false;
  stalkEndTime = 0;
  lungeEndTime = 0;
  ambushCooldownEnd = 0;
  ambushDx = 0;
  ambushDy = 0;
  // Persistent unit heading for smooth steering (0,0 until the first pursuit frame).
  headingX = 0;
  headingY = 0;
  // Large-hammerhead flank side, committed lazily: -1, 0 (unset), or 1.
  flankSign = 0;

  constructor(i: number) {
    this.id = i;
    this._x = Math.floor(Math.random() * 100);
    this._y = Math.floor(Math.random() * 100);
    this.lastX = this._x;
    this.lastY = this._y;
    this.kind = 'tiger';
  }

  distanceBetween(other: { _x: number; _y: number }): number {
    return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2);
  }

  /**
   * Eases the persistent heading toward a desired direction (turn 0..1). The heading is only
   * clamped to length <= 1, never inflated, so a shark reversing course dips through near-zero
   * speed and turns smoothly instead of snapping 180 degrees.
   */
  private steer(desiredX: number, desiredY: number, turn: number): void {
    const dl = Math.hypot(desiredX, desiredY);
    if (dl < 1e-4) return;
    const tx = desiredX / dl;
    const ty = desiredY / dl;
    if (this.headingX === 0 && this.headingY === 0) {
      this.headingX = tx;
      this.headingY = ty;
      return;
    }
    this.headingX += (tx - this.headingX) * turn;
    this.headingY += (ty - this.headingY) * turn;
    const hl = Math.hypot(this.headingX, this.headingY);
    if (hl > 1) {
      this.headingX /= hl;
      this.headingY /= hl;
    }
  }

  move(
    speed: number,
    player: Dolphin | null,
    sharks: Shark[],
    unlimitedRange = false,
    now: number = Date.now(),
    podThreat = false,
  ): void {
    if (!player) return;
    const huntRadius = 25;
    const distToPlayer = this.distanceBetween(player);
    const margin = Math.ceil((24 * this.sizeMultiplier) / (CANVAS_SIZE / SIZE));
    const keepX = this.kind === 'tiger' || this.matriarch ? clampX : wrapX;

    // The Matriarch gets this same charge ability once every escort is gone and she's alone -
    // see updateMatriarch() in game.ts, which also bumps her speedMultiplier at that point.
    const matriarchAlone = this.matriarch && sharks.length === 1;
    if ((this.kind === 'greatWhite' && this.large && !this.matriarch && sharks.every((s) => s.large)) || matriarchAlone) {
      // Twice as fast as an ordinary large great white's charge - she's meant to be the scariest
      // thing in the water once she's down to her last stand.
      const chargeSpeed = matriarchAlone ? CHARGE_SPEED * 2 : CHARGE_SPEED;
      if (this.charging) {
        if (now < this.chargeEndTime) {
          this._x = keepX(this._x + this.chargeDx * speed * this.speedMultiplier * chargeSpeed);
          this._y = clampEntityY(this._y + this.chargeDy * speed * this.speedMultiplier * chargeSpeed, margin);
          return;
        } else {
          this.charging = false;
          this.chargeCooldownEnd = now + CHARGE_COOLDOWN;
        }
      } else if (now >= this.chargeCooldownEnd && distToPlayer >= CHARGE_MIN_DIST && distToPlayer <= CHARGE_MAX_DIST) {
        // Aims straight at the player, deliberately without leading the target: a predicted
        // intercept sent the charge into empty water whenever the player turned, which read as
        // far less threatening than a shark barrelling directly at you.
        const odx = directionDelta(player._x, this._x);
        const ody = player._y - this._y;
        const d = Math.sqrt(odx * odx + ody * ody);
        if (d > 0) {
          this.chargeDx = odx / d;
          this.chargeDy = ody / d;
          this.charging = true;
          this.chargeEndTime = now + CHARGE_DURATION;
          this._x = keepX(this._x + this.chargeDx * speed * this.speedMultiplier * chargeSpeed);
          this._y = clampEntityY(this._y + this.chargeDy * speed * this.speedMultiplier * chargeSpeed, margin);
          return;
        }
      }
    }

    if (this.kind === 'tiger' && this.large && sharks.every((s) => s.large)) {
      if (this.ambushing) {
        if (this.stalking) {
          if (now >= this.stalkEndTime) {
            this.stalking = false;
            this.lungeEndTime = now + AMBUSH_LUNGE_DURATION;
            const odx = directionDelta(player._x, this._x);
            const ody = player._y - this._y;
            const d = Math.sqrt(odx * odx + ody * ody);
            if (d > 0) {
              this.ambushDx = odx / d;
              this.ambushDy = ody / d;
            }
          } else {
            return;
          }
        }
        if (!this.stalking && now < this.lungeEndTime) {
          this._x = keepX(this._x + this.ambushDx * speed * this.speedMultiplier * AMBUSH_SPEED);
          this._y = clampEntityY(this._y + this.ambushDy * speed * this.speedMultiplier * AMBUSH_SPEED, margin);
          return;
        } else if (!this.stalking) {
          this.ambushing = false;
          this.ambushCooldownEnd = now + AMBUSH_COOLDOWN;
        }
      } else if (now >= this.ambushCooldownEnd && distToPlayer >= AMBUSH_MIN_DIST && distToPlayer <= AMBUSH_RANGE) {
        this.ambushing = true;
        this.stalking = true;
        this.stalkEndTime = now + AMBUSH_STALK_DURATION;
        return;
      }
    }

    if (unlimitedRange || distToPlayer <= huntRadius) {
      // Continuous heading toward the player - the base of every pursuit behaviour below.
      const toPlayerX = directionDelta(player._x, this._x);
      const toPlayerY = player._y - this._y;
      const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
      let desX = toPlayerX;
      let desY = toPlayerY;

      // Large hammerheads swing wide and come in from the side; the offset shrinks to 0 as
      // they close so they still connect. Two hammerheads on opposite sides form a pincer.
      const flanking = this.large && this.kind === 'hammerhead';
      if (flanking) {
        if (this.flankSign === 0) this.flankSign = toPlayerY >= 0 ? 1 : -1;
        const perpX = -toPlayerY / dist;
        const perpY = toPlayerX / dist;
        // Arc in from the side while far; within ~8 units drop the arc and drive straight so it connects.
        const offset = dist > 8 ? Math.min(3 + (dist - 8) * 0.5, 12) : 0;
        desX = toPlayerX + perpX * offset * this.flankSign;
        desY = toPlayerY + perpY * offset * this.flankSign;
      }

      // Hunting Mode + a pod big enough to destroy this shark: hang back but keep pressing.
      if (podThreat) {
        const buffer = this.large ? 8 : 5;
        if (dist < buffer) {
          desX = toPlayerX - (toPlayerX / dist) * buffer * 1.6;
          desY = toPlayerY - (toPlayerY / dist) * buffer * 1.6;
        }
      }

      // Boids-style separation from nearby sharks.
      let sepDx = 0;
      let sepDy = 0;
      for (const other of sharks) {
        if (other === this) continue;
        const odx = directionDelta(this._x, other._x);
        const ody = this._y - other._y;
        const d = Math.sqrt(odx * odx + ody * ody);
        if (d < 6 && d > 0) {
          sepDx += odx / d;
          sepDy += ody / d;
        }
      }
      desX += sepDx * 3;
      desY += sepDy * 3;

      this.steer(desX, desY, flanking ? 0.28 : 0.18);
      // 0.95, not the original 0.7: that figure was tuned against the old 8-direction movement,
      // which stepped a full unit on BOTH axes at once (~1.41x the distance on a diagonal). A
      // unit heading caps total movement at 1, so the same constant made every diagonal chase
      // ~29% slower and sharks stopped feeling threatening.
      const effectiveSpeed = speed * this.speedMultiplier * 0.95 * (podThreat ? 0.7 : 1);
      this._x = keepX(this._x + this.headingX * effectiveSpeed);
      this._y = clampEntityY(this._y + this.headingY * effectiveSpeed, margin);
    } else {
      const wanderSpeed = 1 + Math.random() * 2.5;
      if (Math.random() < 0.5) {
        this._x = keepX(this._x + (Math.random() < 0.5 ? 1 : -1) * wanderSpeed);
      }
      if (Math.random() < 0.5) {
        this._y = clampEntityY(this._y + (Math.random() < 0.5 ? 1 : -1) * wanderSpeed, margin);
      }
    }
  }
}

export class MagicShrimp {
  _x: number;
  _y: number;

  constructor() {
    this._x = Math.floor(Math.random() * 100);
    this._y = Math.floor(Math.random() * 100);
  }

  distanceBetween(other: { _x: number; _y: number }): number {
    return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2);
  }
}

export class Jellyfish {
  id: number;
  _x: number;
  _y: number;
  speed: number;

  constructor(id: number, y: number) {
    this.id = id;
    this._x = SIZE + Math.random() * 20;
    this._y = y;
    this.speed = 0.2 + Math.random() * 0.3;
  }

  distanceBetween(other: { _x: number; _y: number }): number {
    return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2);
  }
}
