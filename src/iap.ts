import { registerPlugin } from '@capacitor/core';
import { isAndroid } from './platform';

/**
 * Google Play Billing - Android only. On web `plugin` is null and every method
 * is a safe no-op (the paid Continue button just stays hidden).
 *
 * The native side is `android/app/src/main/java/.../BillingPlugin.java`.
 *
 * `continue_run` must exist in Play Console as a **consumable** managed product.
 * Its price is read from the store at runtime (never hard-coded).
 */

export const CONTINUE_PRODUCT_ID = 'continue_run';

interface ProductResult {
  available: boolean;
  price?: string;
  priceAmountMicros?: number;
  currency?: string;
  title?: string;
}

interface BillingNative {
  connect(): Promise<{ ready: boolean }>;
  getProduct(options: { productId: string }): Promise<ProductResult>;
  purchase(options: { productId: string }): Promise<{ purchased: boolean }>;
}

const plugin = isAndroid ? registerPlugin<BillingNative>('Billing') : null;

let connectStarted: Promise<boolean> | null = null;

export const iap = {
  /** True only in the Android app with the native plugin present. */
  get available(): boolean {
    return plugin !== null;
  },

  /** Opens the BillingClient connection once. Safe to call repeatedly. */
  async init(): Promise<boolean> {
    if (!plugin) return false;
    if (!connectStarted) {
      connectStarted = plugin
        .connect()
        .then((r) => r.ready)
        .catch((e) => {
          console.warn('Billing connect failed', e);
          return false;
        });
    }
    return connectStarted;
  },

  /** The localized price string for the Continue product (e.g. "£0.99"), or null if unavailable. */
  async continuePrice(): Promise<string | null> {
    if (!plugin) return null;
    try {
      await iap.init();
      const p = await plugin.getProduct({ productId: CONTINUE_PRODUCT_ID });
      return p.available && p.price ? p.price : null;
    } catch (e) {
      console.warn('getProduct failed', e);
      return null;
    }
  },

  /** Launches the purchase flow for the Continue product. Returns true if bought (and consumed). */
  async buyContinue(): Promise<boolean> {
    if (!plugin) return false;
    try {
      await iap.init();
      return (await plugin.purchase({ productId: CONTINUE_PRODUCT_ID })).purchased;
    } catch (e) {
      console.warn('purchase failed', e);
      return false;
    }
  },
};
