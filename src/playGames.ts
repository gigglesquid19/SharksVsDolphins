import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Google Play Games Services leaderboards - Android only.
 *
 * On web / PWA `plugin` is null and every method here is a no-op (or returns
 * null/false), so callers can use it unconditionally; the local leaderboards in
 * `scoring.ts` remain the source of truth everywhere and the only one on the web.
 *
 * The native side is `android/app/src/main/java/.../PlayGamesPlugin.java`.
 */

interface PlayerScoreResult {
  hasScore: boolean;
  rank?: number;
  displayRank?: string;
  displayScore?: string;
  rawScore?: number;
}

interface PlayGamesNative {
  isAuthenticated(): Promise<{ authenticated: boolean }>;
  signIn(): Promise<{ authenticated: boolean }>;
  submitScore(options: { leaderboardId: string; value: number }): Promise<void>;
  getPlayerScore(options: { leaderboardId: string }): Promise<PlayerScoreResult>;
  showLeaderboard(options?: { leaderboardId?: string }): Promise<void>;
}

/**
 * Leaderboard IDs from Play Console -> Play Games Services -> Leaderboards (they
 * look like `CgkI...`). Replace the placeholders; until then `submit`/`playerScore`
 * calls fail on the native side and are swallowed.
 */
const LEADERBOARD_IDS = {
  campaign: 'REPLACE_WITH_CAMPAIGN_LEADERBOARD_ID',
  endless: 'REPLACE_WITH_ENDLESS_LEADERBOARD_ID',
} as const;

export type OnlineBoard = keyof typeof LEADERBOARD_IDS;
export type { PlayerScoreResult };

const plugin =
  Capacitor.getPlatform() === 'android' ? registerPlugin<PlayGamesNative>('PlayGames') : null;

export const playGames = {
  /** True only in the Android app with the native plugin present. */
  get available(): boolean {
    return plugin !== null;
  },

  /** Current sign-in state (Play Games v2 signs in automatically on launch). */
  async ensureSignedIn(): Promise<boolean> {
    if (!plugin) return false;
    try {
      return (await plugin.isAuthenticated()).authenticated;
    } catch (e) {
      console.warn('PlayGames isAuthenticated failed', e);
      return false;
    }
  },

  /** Explicit sign-in, e.g. after the player taps a "Sign in" button. */
  async signIn(): Promise<boolean> {
    if (!plugin) return false;
    try {
      return (await plugin.signIn()).authenticated;
    } catch (e) {
      console.warn('PlayGames signIn failed', e);
      return false;
    }
  },

  /**
   * Submit a run's result. Campaign scores are milliseconds (Time-formatted board,
   * smaller is better); Endless scores are the level reached (Numeric, larger is better).
   */
  async submit(board: OnlineBoard, value: number): Promise<void> {
    if (!plugin) return;
    try {
      await plugin.submitScore({ leaderboardId: LEADERBOARD_IDS[board], value: Math.round(value) });
    } catch (e) {
      console.warn('PlayGames submitScore failed', e);
    }
  },

  /** The player's global rank/score for a board, or null if unavailable / no score yet. */
  async playerScore(board: OnlineBoard): Promise<PlayerScoreResult | null> {
    if (!plugin) return null;
    try {
      return await plugin.getPlayerScore({ leaderboardId: LEADERBOARD_IDS[board] });
    } catch (e) {
      console.warn('PlayGames getPlayerScore failed', e);
      return null;
    }
  },

  /** Open Google's native full-screen leaderboard UI. */
  async open(board?: OnlineBoard): Promise<void> {
    if (!plugin) return;
    try {
      await plugin.showLeaderboard(board ? { leaderboardId: LEADERBOARD_IDS[board] } : undefined);
    } catch (e) {
      console.warn('PlayGames showLeaderboard failed', e);
    }
  },
};
