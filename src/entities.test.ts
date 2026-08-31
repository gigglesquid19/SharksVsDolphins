import { describe, expect, it } from 'vitest';
import { Dolphin, Jellyfish, MagicShrimp, Shark } from './entities';

describe('Dolphin', () => {
  it('measures Euclidean distance between points', () => {
    const a = new Dolphin(0, 0, 0);
    expect(a.distanceBetween({ _x: 3, _y: 4 })).toBe(5);
  });

  it('does not move the player-controlled dolphin', () => {
    const player = new Dolphin(0, 50, 50);
    player.isPlayer = true;
    player.move([]);
    expect(player._x).toBe(50);
    expect(player._y).toBe(50);
  });

  it('does not move an already-recruited dolphin (followers are repositioned elsewhere)', () => {
    const follower = new Dolphin(0, 50, 50);
    follower.recruited = true;
    follower.move([]);
    expect(follower._x).toBe(50);
    expect(follower._y).toBe(50);
  });

  it('flees directly away from a nearby shark', () => {
    const dolphin = new Dolphin(0, 50, 50);
    const shark = new Shark(0);
    shark._x = 60;
    shark._y = 55;
    dolphin.move([shark]);
    expect(dolphin._x).toBe(48);
    expect(dolphin._y).toBe(48);
  });
});

describe('Shark', () => {
  it('measures Euclidean distance between points', () => {
    const shark = new Shark(0);
    shark._x = 0;
    shark._y = 0;
    expect(shark.distanceBetween({ _x: 3, _y: 4 })).toBe(5);
  });

  it('chases a player within hunt range along the shortest wrapped path', () => {
    const shark = new Shark(0);
    shark._x = 50;
    shark._y = 50;
    shark.kind = 'tiger';
    const player = new Dolphin(0, 50, 60);
    shark.move(1, player, [shark], false, 0);
    // Straight line toward the player at the pursuit speed (speed x speedMultiplier x 0.95).
    expect(shark._x).toBeCloseTo(50.95);
    expect(shark._y).toBe(50);
  });

  it('does nothing without a player to react to', () => {
    const shark = new Shark(0);
    shark._x = 50;
    shark._y = 50;
    shark.move(1, null, [shark]);
    expect(shark._x).toBe(50);
    expect(shark._y).toBe(50);
  });
});

describe('MagicShrimp', () => {
  it('spawns within the world bounds', () => {
    const shrimp = new MagicShrimp();
    expect(shrimp._x).toBeGreaterThanOrEqual(0);
    expect(shrimp._x).toBeLessThan(100);
    expect(shrimp._y).toBeGreaterThanOrEqual(0);
    expect(shrimp._y).toBeLessThan(100);
  });
});

describe('Jellyfish', () => {
  it('spawns off the right edge at the given height, drifting left', () => {
    const jelly = new Jellyfish(0, 42);
    expect(jelly._y).toBe(42);
    expect(jelly._x).toBeGreaterThanOrEqual(100);
    expect(jelly._x).toBeLessThan(120);
    expect(jelly.speed).toBeGreaterThanOrEqual(0.2);
    expect(jelly.speed).toBeLessThan(0.5);
  });
});

// --- Advanced pursuit AI (steering, flanking, pod-awareness) ---

const NOW = 1_000_000;

/** A stationary player at (x, y) with matching lastX/lastY (no velocity). */
function playerAt(x: number, y: number): Dolphin {
  const d = new Dolphin(0, y, x);
  d.isPlayer = true;
  d.lastX = x;
  d.lastY = y;
  return d;
}

function testShark(x: number, y: number, opts: Partial<Shark> = {}): Shark {
  const s = new Shark(1);
  s._x = x;
  s._y = y;
  s.lastX = x;
  s.lastY = y;
  Object.assign(s, opts);
  return s;
}

describe('Shark.move smooth pursuit', () => {
  it('steers a unit heading toward the player and closes distance', () => {
    const p = playerAt(60, 50);
    const s = testShark(40, 50);
    for (let i = 0; i < 15; i++) s.move(1, p, [s], true, NOW);
    expect(Math.hypot(s.headingX, s.headingY)).toBeCloseTo(1, 2);
    expect(s.distanceBetween(p)).toBeLessThan(20);
  });
});

describe('Shark.move idle search', () => {
  // A tiger only wanders when the player is outside its 25-unit hunt radius and it has no
  // unlimited range (great whites / hammerheads always pursue, so they never idle).
  function wanderPath(ticks: number) {
    const p = playerAt(95, 95);
    const s = testShark(20, 50);
    const vecs: [number, number][] = [];
    for (let i = 0; i < ticks; i++) {
      const bx = s._x;
      const by = s._y;
      s.move(1, p, [s], false, NOW);
      let vx = s._x - bx;
      if (vx > 50) vx -= 100;
      if (vx < -50) vx += 100;
      const vy = s._y - by;
      if (Math.hypot(vx, vy) > 0.01) vecs.push([vx, vy]);
    }
    return { s, vecs };
  }

  it('cruises instead of twitching on the spot', () => {
    const { vecs } = wanderPath(200);
    // The old wander rolled a fresh random axis/sign/distance each tick: ~87 degrees of
    // direction change per tick and 13% outright reversals. A cruising shark turns gently.
    let sum = 0;
    let reversals = 0;
    for (let i = 1; i < vecs.length; i++) {
      const a = Math.atan2(vecs[i - 1][1], vecs[i - 1][0]);
      const b = Math.atan2(vecs[i][1], vecs[i][0]);
      let diff = Math.abs(b - a) * (180 / Math.PI);
      if (diff > 180) diff = 360 - diff;
      sum += diff;
      if (diff > 150) reversals++;
    }
    expect(sum / (vecs.length - 1)).toBeLessThan(20);
    expect(reversals).toBeLessThan(vecs.length * 0.05);
  });

  it('actually gets somewhere rather than milling in place', () => {
    const { s } = wanderPath(200);
    expect(s.distanceBetween({ _x: 20, _y: 50 })).toBeGreaterThan(10);
  });

  it('stays within the vertical bounds while searching', () => {
    const p = playerAt(95, 95);
    const s = testShark(20, 50);
    for (let i = 0; i < 400; i++) {
      s.move(1, p, [s], false, NOW);
      expect(s._y).toBeGreaterThanOrEqual(0);
      expect(s._y).toBeLessThanOrEqual(100);
    }
  });
});

describe('Shark.move large-hammerhead flank', () => {
  it('approaches at an angle, not straight at a distant player', () => {
    const p = playerAt(30, 90);
    const s = testShark(30, 50, { kind: 'hammerhead', large: true });
    s.move(1, p, [s], true, NOW);
    // A head-on chase would leave headingX ~ 0 (the player is directly "below").
    expect(Math.abs(s.headingX)).toBeGreaterThan(0.2);
  });

  it('converges on the player once close', () => {
    const p = playerAt(50, 50);
    const s = testShark(50, 46, { kind: 'hammerhead', large: true });
    for (let i = 0; i < 20; i++) s.move(1, p, [s], true, NOW);
    expect(s.distanceBetween(p)).toBeLessThan(4);
  });
});

describe('Shark.move pod-threat', () => {
  it('backs away when inside the buffer and the pod can kill it', () => {
    const p = playerAt(50, 50);
    const wary = testShark(53, 50);
    const bold = testShark(53, 50);
    for (let i = 0; i < 12; i++) {
      wary.move(1, p, [wary], true, NOW, true);
      bold.move(1, p, [bold], true, NOW, false);
    }
    expect(wary.distanceBetween(p)).toBeGreaterThan(bold.distanceBetween(p));
    expect(wary.distanceBetween(p)).toBeGreaterThan(3);
  });

  it('holds a buffer wider than a large shark can be rammed from, so the retreat must be cancellable', () => {
    // Large sharks are only destroyed by a boost-ram, and Game.sharkRamRadius gives a large
    // tiger 4 * sqrt(2.5) = 6.32. The wary buffer is 8, so a retreating large shark sits
    // outside kill range: game.ts must clear podThreat while the player sprints, or the shark
    // is unkillable. This pins the numbers that make that necessary.
    const LARGE_BUFFER = 8;
    const largeTigerRamRadius = 4 * Math.sqrt(1 * 2.5); // 6.32
    const largeHammerheadRamRadius = 4 * Math.sqrt(2 * 1.8); // 7.59
    expect(largeTigerRamRadius).toBeLessThan(LARGE_BUFFER);
    expect(largeHammerheadRamRadius).toBeLessThan(LARGE_BUFFER);

    // Behaviourally: a wary large shark reaches beyond ram range, i.e. it can sit where a boost
    // cannot reach it. Uses a hammerhead - a large tiger would enter its ambush stalk and freeze
    // (it stays frozen here because `now` is fixed), and a great white would start a charge.
    const p = playerAt(50, 50);
    const s = testShark(56, 50, { kind: 'hammerhead', large: true, sizeMultiplier: 1.8 });
    let furthest = 0;
    for (let i = 0; i < 15; i++) {
      s.move(1, p, [s], true, NOW, true);
      furthest = Math.max(furthest, s.distanceBetween(p));
    }
    expect(furthest).toBeGreaterThan(largeHammerheadRamRadius);
  });

  it('still presses toward the player from outside the buffer', () => {
    const p = playerAt(50, 50);
    const s = testShark(20, 50);
    const start = s.distanceBetween(p);
    for (let i = 0; i < 10; i++) s.move(1, p, [s], true, NOW, true);
    expect(s.distanceBetween(p)).toBeLessThan(start);
  });
});
