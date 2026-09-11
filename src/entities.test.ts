import { describe, expect, it } from 'vitest';
import { Dolphin, Jellyfish, Shark } from './entities';

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

describe('Shark.move hunt radius', () => {
  // A single tick tells the two branches apart deterministically: a pursuer takes a step of
  // exactly speed x speedMultiplier x 0.95 straight at the player, a searcher takes one of
  // x 0.6 in a random direction. Running many ticks would be flaky, because a searcher that
  // happens to wander inside the radius legitimately re-acquires the player.
  const PURSUIT_STEP = 0.95;
  const CRUISE_STEP = 0.6;

  /** A small decoy keeps sharks.every(large) false, so a large tiger does not enter its ambush. */
  function step(shark: Shark, player: Dolphin): number {
    const bx = shark._x;
    const by = shark._y;
    shark.move(1, player, [shark, testShark(95, 95)], false, NOW);
    return Math.hypot(shark._x - bx, shark._y - by);
  }

  it('a large shark still hunts a player 30 units away', () => {
    const p = playerAt(50, 50);
    const big = testShark(80, 50, { large: true });
    expect(step(big, p)).toBeCloseTo(PURSUIT_STEP, 5);
    expect(big._x).toBeLessThan(80); // moved toward the player
  });

  it('a small shark at the same distance has lost track and is searching', () => {
    const p = playerAt(50, 50);
    const small = testShark(80, 50);
    expect(step(small, p)).toBeCloseTo(CRUISE_STEP, 5);
  });

  it('a large shark still loses track past its wider radius', () => {
    const p = playerAt(50, 50);
    const big = testShark(95, 50, { large: true });
    expect(step(big, p)).toBeCloseTo(CRUISE_STEP, 5);
  });
});

describe('Shark.move Matriarch charge', () => {
  function matriarch(x: number, y: number): Shark {
    return testShark(x, y, { kind: 'greatWhite', large: true, matriarch: true, sizeMultiplier: 3.6 });
  }

  /** A charge covers far more ground in one tick than the ~1 unit ordinary pursuit manages. */
  function firstStep(m: Shark, p: Dolphin, others: Shark[]): number {
    const bx = m._x;
    const by = m._y;
    m.move(1, p, [m, ...others], true, NOW);
    return Math.hypot(m._x - bx, m._y - by);
  }

  it('charges once enraged even though she keeps calling in fresh escorts', () => {
    // She summons a great white every 20 seconds, so gating the charge on "she is the only shark
    // left" switched it off again the moment each escort arrived - she spent the fight cruising.
    const p = playerAt(50, 50);
    const m = matriarch(70, 50);
    m.enraged = true;
    const escort = testShark(90, 90, { kind: 'greatWhite', large: true });
    expect(firstStep(m, p, [escort])).toBeGreaterThan(2);
  });

  it('still charges while she genuinely is the last shark in the water', () => {
    const p = playerAt(50, 50);
    const m = matriarch(70, 50);
    expect(firstStep(m, p, [])).toBeGreaterThan(2);
  });

  it('does not charge before she is enraged and escorts are still alive', () => {
    const p = playerAt(50, 50);
    const m = matriarch(70, 50);
    const escort = testShark(90, 90, { kind: 'greatWhite', large: true });
    expect(firstStep(m, p, [escort])).toBeLessThan(2);
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

describe('Shark.move never retreats from the pod', () => {
  it('keeps closing on a pod big enough to destroy it', () => {
    // Sharks used to hold a buffer off a kill-capable pod. It read as the shark fleeing rather
    // than stalking, and parked it outside the range you could ram it from, so it is gone: every
    // shark now presses the attack regardless of how many dolphins you have.
    const p = playerAt(50, 50);
    const s = testShark(53, 50);
    for (let i = 0; i < 12; i++) s.move(1, p, [s], true, NOW);
    expect(s.distanceBetween(p)).toBeLessThan(3);
  });
});

describe('Shark.move search drift', () => {
  // Beyond the hunt radius a shark is searching rather than chasing, but it should still be
  // working its way toward the pod - sharks milling at random read as ignoring the player,
  // which is the wrong feel for the opening of a level.
  it('closes on a player it has not noticed yet', () => {
    const p = playerAt(50, 50);
    const s = testShark(90, 50);
    const start = s.distanceBetween(p);
    for (let i = 0; i < 60; i++) s.move(1, p, [s], false, NOW);
    expect(s.distanceBetween(p)).toBeLessThan(start);
  });

  it('drifts in from any direction, not just one axis', () => {
    const p = playerAt(50, 50);
    for (const [x, y] of [[90, 50], [10, 50], [50, 90], [50, 12]] as [number, number][]) {
      const s = testShark(x, y);
      const start = s.distanceBetween(p);
      for (let i = 0; i < 60; i++) s.move(1, p, [s], false, NOW);
      expect(s.distanceBetween(p)).toBeLessThan(start);
    }
  });

  it('still wanders rather than driving straight at the player', () => {
    // If the drift dominated, the search would just be a slower chase. Compare the ground it
    // covers against the distance it actually closed: a straight run would make these equal.
    const p = playerAt(50, 50);
    const s = testShark(90, 50);
    const start = s.distanceBetween(p);
    let travelled = 0;
    for (let i = 0; i < 60; i++) {
      const bx = s._x;
      const by = s._y;
      s.move(1, p, [s], false, NOW);
      travelled += Math.hypot(s._x - bx, s._y - by);
    }
    const closed = start - s.distanceBetween(p);
    expect(closed).toBeLessThan(travelled * 0.95);
  });
});
