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
    expect(shark._x).toBeCloseTo(50.7);
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
