import { Capacitor } from '@capacitor/core';

/**
 * True only inside the native Android app. Monetisation (src/ads.ts, src/iap.ts)
 * and the paid Continue flow are Android-only - the PWA build behaves exactly as
 * it did before, for testing.
 */
export const isAndroid = Capacitor.getPlatform() === 'android';
