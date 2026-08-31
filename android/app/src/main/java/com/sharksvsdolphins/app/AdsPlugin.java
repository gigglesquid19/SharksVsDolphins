package com.sharksvsdolphins.app;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * AdMob bridge (Android only). The web/PWA build never loads this - src/ads.ts
 * guards on Capacitor.getPlatform() === 'android'.
 *
 * One rewarded ad and one interstitial are cached at a time. Ad unit ids are
 * passed in from JS (src/ads.ts is the single source). Every method resolves on
 * success; the TS wrapper swallows failures and just doesn't offer the ad.
 */
@CapacitorPlugin(name = "Ads")
public class AdsPlugin extends Plugin {

    private RewardedAd rewardedAd;
    private InterstitialAd interstitialAd;
    private boolean mobileAdsInitialised = false;

    /** UMP consent gathering, then MobileAds init. Idempotent. */
    @PluginMethod
    public void initialize(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(activity);
            ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
            consentInformation.requestConsentInfoUpdate(
                activity,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> initMobileAds(call)),
                requestError -> initMobileAds(call)
            );
        });
    }

    private void initMobileAds(PluginCall call) {
        if (mobileAdsInitialised) {
            call.resolve();
            return;
        }
        MobileAds.initialize(getContext(), initializationStatus -> {
            mobileAdsInitialised = true;
            call.resolve();
        });
    }

    @PluginMethod
    public void loadRewarded(PluginCall call) {
        String unitId = call.getString("unitId");
        if (unitId == null) {
            call.reject("unitId is required");
            return;
        }
        getActivity().runOnUiThread(() ->
            RewardedAd.load(getContext(), unitId, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(RewardedAd ad) {
                    rewardedAd = ad;
                    resolveLoaded(call, true);
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    rewardedAd = null;
                    resolveLoaded(call, false);
                }
            })
        );
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null || rewardedAd == null) {
            resolveRewarded(call, false);
            return;
        }
        final boolean[] earned = { false };
        activity.runOnUiThread(() -> {
            RewardedAd ad = rewardedAd;
            rewardedAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    resolveRewarded(call, earned[0]);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    resolveRewarded(call, false);
                }
            });
            ad.show(activity, rewardItem -> earned[0] = true);
        });
    }

    @PluginMethod
    public void loadInterstitial(PluginCall call) {
        String unitId = call.getString("unitId");
        if (unitId == null) {
            call.reject("unitId is required");
            return;
        }
        getActivity().runOnUiThread(() ->
            InterstitialAd.load(getContext(), unitId, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(InterstitialAd ad) {
                    interstitialAd = ad;
                    resolveLoaded(call, true);
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    interstitialAd = null;
                    resolveLoaded(call, false);
                }
            })
        );
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null || interstitialAd == null) {
            resolveShown(call, false);
            return;
        }
        activity.runOnUiThread(() -> {
            InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    resolveShown(call, true);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    resolveShown(call, false);
                }
            });
            ad.show(activity);
        });
    }

    private void resolveLoaded(PluginCall call, boolean loaded) {
        JSObject ret = new JSObject();
        ret.put("loaded", loaded);
        call.resolve(ret);
    }

    private void resolveRewarded(PluginCall call, boolean rewarded) {
        JSObject ret = new JSObject();
        ret.put("rewarded", rewarded);
        call.resolve(ret);
    }

    private void resolveShown(PluginCall call, boolean shown) {
        JSObject ret = new JSObject();
        ret.put("shown", shown);
        call.resolve(ret);
    }
}
