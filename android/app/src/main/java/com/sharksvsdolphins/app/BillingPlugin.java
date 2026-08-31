package com.sharksvsdolphins.app;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * Google Play Billing bridge (Android only) for the paid Continue - a single
 * **consumable** product (`continue_run`). The web/PWA build never loads this
 * (src/iap.ts guards on the platform).
 *
 * Flow: connect() -> getProduct() for the price -> purchase() launches the
 * Play dialog; on success the purchase is consumed immediately so it can be
 * bought again next run. Un-consumed purchases from a previous crash are
 * cleaned up on connect().
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin {

    private BillingClient billingClient;
    private ProductDetails continueProduct;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient
            .newBuilder(getContext())
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .setListener((billingResult, purchases) -> onPurchasesUpdated(billingResult, purchases))
            .build();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (billingClient.isReady()) {
            resolveReady(call, true);
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                boolean ok = result.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (ok) consumeStalePurchases();
                resolveReady(call, ok);
            }

            @Override
            public void onBillingServiceDisconnected() {
                // The TS side calls connect() again on demand.
            }
        });
    }

    @PluginMethod
    public void getProduct(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("productId is required");
            return;
        }
        QueryProductDetailsParams params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product
                    .newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            ))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            JSObject ret = new JSObject();
            ProductDetails details = productDetailsList.isEmpty() ? null : productDetailsList.get(0);
            ProductDetails.OneTimePurchaseOfferDetails offer =
                details == null ? null : details.getOneTimePurchaseOfferDetails();
            if (offer == null) {
                ret.put("available", false);
            } else {
                continueProduct = details;
                ret.put("available", true);
                ret.put("price", offer.getFormattedPrice());
                ret.put("priceAmountMicros", offer.getPriceAmountMicros());
                ret.put("currency", offer.getPriceCurrencyCode());
                ret.put("title", details.getTitle());
            }
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("productId is required");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        if (continueProduct == null || !continueProduct.getProductId().equals(productId)) {
            call.reject("Call getProduct first");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("A purchase is already in progress");
            return;
        }
        pendingPurchaseCall = call;

        BillingFlowParams flowParams = BillingFlowParams
            .newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams
                    .newBuilder()
                    .setProductDetails(continueProduct)
                    .build()
            ))
            .build();

        activity.runOnUiThread(() -> {
            BillingResult result = billingClient.launchBillingFlow(activity, flowParams);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                resolvePurchased(false);
            }
        });
    }

    private void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED || purchases == null) {
            resolvePurchased(false);
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK) {
            resolvePurchased(false);
            return;
        }
        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                consume(purchase, true);
            }
        }
    }

    private void consume(Purchase purchase, boolean grantOnSuccess) {
        ConsumeParams params = ConsumeParams
            .newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.consumeAsync(params, (billingResult, purchaseToken) -> {
            if (grantOnSuccess) {
                resolvePurchased(billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK);
            }
        });
    }

    /** On (re)connect, consume anything left over from a crash mid-purchase. */
    private void consumeStalePurchases() {
        billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (billingResult, purchases) -> {
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        consume(purchase, false);
                    }
                }
            }
        );
    }

    private void resolveReady(PluginCall call, boolean ready) {
        JSObject ret = new JSObject();
        ret.put("ready", ready);
        call.resolve(ret);
    }

    private void resolvePurchased(boolean purchased) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) return;
        JSObject ret = new JSObject();
        ret.put("purchased", purchased);
        call.resolve(ret);
    }
}
