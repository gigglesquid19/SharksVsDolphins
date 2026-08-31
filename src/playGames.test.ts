import { describe, expect, it } from 'vitest';
import { playGames } from './playGames';

// Under vitest/jsdom Capacitor.getPlatform() is 'web', so the native plugin is never
// registered. Every method must degrade to a harmless no-op so game.ts can call it
// unconditionally and the local leaderboards stay the only path on the web.
describe('playGames on web (no native plugin)', () => {
  it('reports itself unavailable', () => {
    expect(playGames.available).toBe(false);
  });

  it('sign-in checks resolve to false without throwing', async () => {
    await expect(playGames.ensureSignedIn()).resolves.toBe(false);
    await expect(playGames.signIn()).resolves.toBe(false);
  });

  it('submit resolves without throwing for both boards', async () => {
    await expect(playGames.submit('campaign', 42_000)).resolves.toBeUndefined();
    await expect(playGames.submit('endless', 12)).resolves.toBeUndefined();
  });

  it('playerScore resolves to null', async () => {
    await expect(playGames.playerScore('campaign')).resolves.toBeNull();
    await expect(playGames.playerScore('endless')).resolves.toBeNull();
  });

  it('open resolves without throwing, with or without a board', async () => {
    await expect(playGames.open('endless')).resolves.toBeUndefined();
    await expect(playGames.open()).resolves.toBeUndefined();
  });
});
