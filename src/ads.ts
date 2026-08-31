import { registerPlugin } from '@capacitor/core';
import { isAndroid } from './platform';

/**
 * AdMob - Android only. On web `plugin` is null and every method is a safe no-op,
 * so callers can use `ads` unconditionally.
 *
 * The native side is `android/app/src/main/java/.../AdsPlugin.java`. Ad unit IDs
 * live here (the single source of truth) and are passed into every native call.
 *
 * IMPORTANT: the IDs below are Google's official TEST units. Swap them (and the
 * app id in android/.../res/values/ads-ids.xml) for the real ones before a
 * production release - serving real ads to yourself during testing can get an
 * AdMob account suspended.
 */

const UNITS = {
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

interface AdsNative {
  initialize(): Promise<void>;
  loadRewarded(options: { unitId: string }): Promise<{ loaded: boolean }>;
  showRewarded(): Promise<{ rewarded: boolean }>;
  loadInterstitial(options: { unitId: string }): Promise<{ loaded: boolean }>;
  showInterstitial(): Promise<{ shown: boolean }>;
}

const plugin = isAndroid ? registerPlugin<AdsNative>('Ads') : null;

let initStarted: Promise<void> | null = null;
let rewardedReady = false;
let interstitialReady = false;

export const ads = {
  /** True only in the Android app with the native plugin present. */
  get available(): boolean {
    return plugin !== null;
  },

  /** Runs the UMP consent flow + MobileAds init once. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (!plugin) return;
    if (!initStarted) {
      initStarted = plugin
        .initialize()
        .then(() => {
          void ads.preloadRewarded();
          void ads.preloadInterstitial();
        })
        .catch((e) => {
          console.warn('Ads init failed', e);
        });
    }
    return initStarted;
  },

  /** Fetches a rewarded ad into memory. Returns whether one is ready to show. */
  async preloadRewarded(): Promise<boolean> {
    if (!plugin) return false;
    try {
      rewardedReady = (await plugin.loadRewarded({ unitId: UNITS.rewarded })).loaded;
    } catch (e) {
      console.warn('loadRewarded failed', e);
      rewardedReady = false;
    }
    return rewardedReady;
  },

  /** Shows the preloaded rewarded ad. Returns true only if the player earned the reward. */
  async showRewarded(): Promise<boolean> {
    if (!plugin) return false;
    try {
      const { rewarded } = await plugin.showRewarded();
      rewardedReady = false;
      void ads.preloadRewarded();
      return rewarded;
    } catch (e) {
      console.warn('showRewarded failed', e);
      return false;
    }
  },

  get rewardedReady(): boolean {
    return rewardedReady;
  },

  async preloadInterstitial(): Promise<void> {
    if (!plugin) return;
    try {
      interstitialReady = (await plugin.loadInterstitial({ unitId: UNITS.interstitial })).loaded;
    } catch (e) {
      console.warn('loadInterstitial failed', e);
      interstitialReady = false;
    }
  },

  /** Shows a preloaded interstitial if one is ready; best-effort, never throws. */
  async maybeShowInterstitial(): Promise<void> {
    if (!plugin || !interstitialReady) return;
    try {
      await plugin.showInterstitial();
    } catch (e) {
      console.warn('showInterstitial failed', e);
    } finally {
      interstitialReady = false;
      void ads.preloadInterstitial();
    }
  },
};
