import { SIZE_X, SIZE_Y, WORLD_SCALE } from './constants';
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
// How far a shark notices the player. A large shark is a bigger, older animal and picks the
// pod up sooner; beyond this it loses track and drops into the idle search cruise.
const HUNT_RADIUS = 25;
const LARGE_HUNT_RADIUS = 40;
const AMBUSH_MIN_DIST = 2;
const AMBUSH_SPEED = 3;
// Idle "searching" cruise: how far the wander angle can drift per tick (radians), how quickly
// the shark turns onto it, and its cruise speed as a fraction of the pursuit speed.
const WANDER_TURN = 0.5;
const WANDER_STEER = 0.12;
const WANDER_SPEED = 0.6;
/** How strongly a searching shark drifts toward the player, against a wander vector of 1.
 *  At parity the shark still visibly meanders, but it is always closing: measured over 200
 *  simulated level-1 openings, 99% of sharks reach within 10 units inside 30 seconds (65% at
 *  0.55), with the average gap going 15 -> 6 -> 4 units at 5s, 15s and 30s. */
const SEARCH_DRIFT = 1.0;
/** How fast a Pistol-Shrimp-stunned shark tumbles away, as a fraction of its pursuit speed. */
const STUN_DRIFT = 0.8;

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
  // Pod members carry a velocity that eases toward what the formation slot asks for, so they
  // bank into turns and glide to a stop instead of snapping (see Game.moveTowards).
  velX = 0;
  velY = 0;

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
  /** Direction the shark is idly cruising in, random-walked while searching. */
  wanderAngle = 0;
  // Large-tiger cloak: it vanishes from view while still tracking you, and is forced back into
  // sight the moment it takes a dolphin. Driven by Game.updateCloaks - see CLOAK_DURATION_MS.
  cloaked = false;
  cloakEndTime = 0;
  cloakCooldownEnd = 0;
  /** Matriarch only: set once every escort has been destroyed, and never cleared again. */
  enraged = false;
  /**
   * Reeling from a Pistol Shrimp blast until this time. A stunned shark drifts away from the
   * blast and cannot hunt, charge or ambush - see Game.usePistolShrimpItem.
   */
  stunnedUntil = 0;
  /** Unit direction the blast threw it in, held for the length of the stun. */
  stunDx = 0;
  stunDy = 0;

  /**
   * Large cookiecutter: the pod member it has singled out, and where the strike has got to.
   *
   * Driven by Game.updateLockOnStrikes rather than by move(), because picking a victim needs the
   * whole pod and move() only ever sees the player. 'warning' is the window the player has to
   * break the line it is about to commit to; 'zoom' is the run itself, aimed once and never
   * corrected, which is what makes boosting out of the way a dodge rather than a delay.
   */
  lockTarget: Dolphin | null = null;
  lockPhase: 'none' | 'warning' | 'zoom' = 'none';
  lockPhaseEndTime = 0;
  lockCooldownEnd = 0;
  lockDx = 0;
  lockDy = 0;

  /**
   * Large frilled: how far the head is thrown forward, 0 (drawn in) to 1 (a full body length out).
   *
   * Held as a fraction rather than a distance because what a body length is in world units is the
   * draw loop's business, not this class's. Game.updateFrilledReach runs the phases; the draw
   * loop stretches the sprite by it and the bite check reaches along it.
   */
  reach = 0;
  reachPhase: 'none' | 'out' | 'hold' | 'back' = 'none';
  reachPhaseEndTime = 0;
  reachCooldownEnd = 0;

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

  /**
   * @param hidden The pod has eaten a Ghost Shrimp: the shark cannot sense the player at all, so
   *   it neither hunts nor drifts toward them. Specials already in flight still finish, because a
   *   lunge that stops dead in the water looks like a bug rather than a trick.
   */
  move(
    speed: number,
    player: Dolphin | null,
    sharks: Shark[],
    unlimitedRange = false,
    now: number = Date.now(),
    hidden = false,
  ): void {
    if (!player) return;
    const huntRadius = this.large ? LARGE_HUNT_RADIUS : HUNT_RADIUS;
    const distToPlayer = this.distanceBetween(player);
    const margin = Math.ceil((24 * this.sizeMultiplier) / WORLD_SCALE);
    const keepX = this.kind === 'tiger' || this.matriarch ? clampX : wrapX;

    // Blasted by a Pistol Shrimp: tumbling away and no threat to anyone until it rights itself.
    // Checked before every special so the blast also breaks a charge that is already running.
    if (now < this.stunnedUntil) {
      const drift = speed * this.speedMultiplier * STUN_DRIFT;
      this._x = keepX(this._x + this.stunDx * drift);
      this._y = clampEntityY(this._y + this.stunDy * drift, margin);
      // Leave the heading pointing the way it was thrown, or it snaps back round the instant
      // the stun ends.
      this.headingX = this.stunDx;
      this.headingY = this.stunDy;
      return;
    }

    // The Matriarch gets this same charge ability once every escort is gone - see
    // updateMatriarch() in game.ts, which also bumps her speedMultiplier at that point. It keys
    // off the sticky `enraged` flag rather than a live headcount, because she calls in a fresh
    // great white every 20 seconds: counting the sharks in the water switched her charge back
    // off the instant each escort arrived, so she spent the fight cruising instead of charging.
    const matriarchUnleashed = this.matriarch && (this.enraged || sharks.length === 1);
    if ((this.kind === 'greatWhite' && this.large && !this.matriarch && sharks.every((s) => s.large)) || matriarchUnleashed) {
      // Twice as fast as an ordinary large great white's charge - she's meant to be the scariest
      // thing in the water once she's down to her last stand.
      const chargeSpeed = matriarchUnleashed ? CHARGE_SPEED * 2 : CHARGE_SPEED;
      if (this.charging) {
        if (now < this.chargeEndTime) {
          this._x = keepX(this._x + this.chargeDx * speed * this.speedMultiplier * chargeSpeed);
          this._y = clampEntityY(this._y + this.chargeDy * speed * this.speedMultiplier * chargeSpeed, margin);
          return;
        } else {
          this.charging = false;
          this.chargeCooldownEnd = now + CHARGE_COOLDOWN;
        }
      } else if (!hidden && now >= this.chargeCooldownEnd && distToPlayer >= CHARGE_MIN_DIST && distToPlayer <= CHARGE_MAX_DIST) {
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
      } else if (!hidden && now >= this.ambushCooldownEnd && distToPlayer >= AMBUSH_MIN_DIST && distToPlayer <= AMBUSH_RANGE) {
        this.ambushing = true;
        this.stalking = true;
        this.stalkEndTime = now + AMBUSH_STALK_DURATION;
        return;
      }
    }

    if (!hidden && (unlimitedRange || distToPlayer <= huntRadius)) {
      // Continuous heading toward the player - the base of every pursuit behaviour below.
      const toPlayerX = directionDelta(player._x, this._x);
      const toPlayerY = player._y - this._y;
      const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
      let desX = toPlayerX;
      let desY = toPlayerY;

      // Flankers swing wide and come in from the side; the offset shrinks to 0 as they close so
      // they still connect. Two on opposite sides form a pincer.
      //
      // Large hammerheads, and every frilled shark whatever its size. The frilled is gated on
      // kind rather than on size because the levels that field one field only small ones - gating
      // it the way the hammerhead is gated would have meant writing a behaviour nothing ever
      // performs. It suits the animal too: a long body that arcs round rather than charging is
      // the thing you are told to outswim rather than outfight.
      const flanking = (this.large && this.kind === 'hammerhead') || this.kind === 'frilled';
      if (flanking) {
        if (this.flankSign === 0) this.flankSign = toPlayerY >= 0 ? 1 : -1;
        const perpX = -toPlayerY / dist;
        const perpY = toPlayerX / dist;
        // Arc in from the side while far; within ~8 units drop the arc and drive straight so it connects.
        const offset = dist > 8 ? Math.min(3 + (dist - 8) * 0.5, 12) : 0;
        desX = toPlayerX + perpX * offset * this.flankSign;
        desY = toPlayerY + perpY * offset * this.flankSign;
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
      const effectiveSpeed = speed * this.speedMultiplier * 0.95;
      this._x = keepX(this._x + this.headingX * effectiveSpeed);
      this._y = clampEntityY(this._y + this.headingY * effectiveSpeed, margin);
    } else {
      // Idle search. The old version rolled a fresh random axis, sign and distance every tick,
      // so a searching shark twitched on the spot instead of going anywhere. Now it holds a
      // wander angle and random-walks the ANGLE, not the position: the shark cruises in long
      // lazy arcs, and because it steers the same persistent heading the pursuit branch uses,
      // spotting the player turns into a smooth acceleration rather than a snap.
      if (this.headingX === 0 && this.headingY === 0) {
        this.wanderAngle = Math.random() * Math.PI * 2;
      }
      this.wanderAngle += (Math.random() - 0.5) * WANDER_TURN;
      let desX = Math.cos(this.wanderAngle);
      let desY = Math.sin(this.wanderAngle);

      // A searching shark closes in rather than milling about at random. Pure wandering read as
      // the sharks ignoring you until you happened to stray inside the hunt radius, which is
      // exactly the wrong feeling for the opening of a level - they should be converging on you
      // from the first seconds. Weighted below the wander itself so the approach still meanders
      // like an animal casting about, rather than turning into a second, slower pursuit.
      // Nothing to converge on while the pod is ghosted, so the shark genuinely casts about
      // instead of quietly homing in on a player it is not supposed to be able to find.
      const toPlayerX = directionDelta(player._x, this._x);
      const toPlayerY = player._y - this._y;
      const toPlayerLen = Math.hypot(toPlayerX, toPlayerY);
      if (!hidden && toPlayerLen > 0) {
        desX += (toPlayerX / toPlayerLen) * SEARCH_DRIFT;
        desY += (toPlayerY / toPlayerLen) * SEARCH_DRIFT;
      }

      // Bank away from the surface and the sea floor instead of sliding along the clamp. The
      // weight has to exceed 1 to actually turn the shark around: at weight 1 it only cancels a
      // heading pointed straight out of bounds, so the shark ran along the edge instead.
      const edge = 12;
      const EDGE_PUSH = 2.5;
      const floor = SIZE_Y - 1 - margin;
      if (this._y < margin + edge) desY += (EDGE_PUSH * (margin + edge - this._y)) / edge;
      else if (this._y > floor - edge) desY -= (EDGE_PUSH * (this._y - (floor - edge))) / edge;

      this.steer(desX, desY, WANDER_STEER);
      // Cruising, not hunting: noticeably slower than the 0.95 pursuit speed, so a shark that
      // notices you visibly picks up pace.
      const cruise = speed * this.speedMultiplier * WANDER_SPEED;
      this._x = keepX(this._x + this.headingX * cruise);
      this._y = clampEntityY(this._y + this.headingY * cruise, margin);
      // The wander angle is deliberately NOT re-synced to the heading here: letting it run
      // ahead is what gives the shark a heading to lean into. Snapping it back each tick
      // averaged the randomness away and the shark cruised in near-perfect straight lines.
    }
  }
}

export class Jellyfish {
  id: number;
  _x: number;
  _y: number;
  speed: number;

  constructor(id: number, y: number) {
    this.id = id;
    this._x = SIZE_X + Math.random() * 20;
    this._y = y;
    this.speed = 0.2 + Math.random() * 0.3;
  }

  distanceBetween(other: { _x: number; _y: number }): number {
    return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2);
  }
}
