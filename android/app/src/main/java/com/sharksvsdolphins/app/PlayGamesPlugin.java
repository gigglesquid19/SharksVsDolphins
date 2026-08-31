package com.sharksvsdolphins.app;

import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;

/**
 * Thin bridge over Google Play Games Services v2 (Android only). The web/PWA build never
 * loads this - src/playGames.ts guards on Capacitor.getPlatform() === 'android'.
 *
 * Every method resolves on success and rejects on failure; the TS wrapper swallows the
 * rejection and falls back to the local leaderboards, so a signed-out or misconfigured
 * device just behaves as before.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    @Override
    public void load() {
        // Safe to call repeatedly; kicks off the v2 automatic sign-in attempt.
        PlayGamesSdk.initialize(getContext());
    }

    @PluginMethod
    public void isAuthenticated(PluginCall call) {
        GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
        client
            .isAuthenticated()
            .addOnCompleteListener(task -> {
                boolean ok = task.isSuccessful() && task.getResult().isAuthenticated();
                JSObject ret = new JSObject();
                ret.put("authenticated", ok);
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
        client
            .signIn()
            .addOnCompleteListener(task -> {
                boolean ok = task.isSuccessful() && task.getResult().isAuthenticated();
                JSObject ret = new JSObject();
                ret.put("authenticated", ok);
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        String leaderboardId = call.getString("leaderboardId");
        Double value = call.getDouble("value");
        if (leaderboardId == null || value == null) {
            call.reject("leaderboardId and value are required");
            return;
        }
        PlayGames.getLeaderboardsClient(getActivity()).submitScore(leaderboardId, value.longValue());
        call.resolve();
    }

    @PluginMethod
    public void getPlayerScore(PluginCall call) {
        String leaderboardId = call.getString("leaderboardId");
        if (leaderboardId == null) {
            call.reject("leaderboardId is required");
            return;
        }
        LeaderboardsClient client = PlayGames.getLeaderboardsClient(getActivity());
        client
            .loadCurrentPlayerLeaderboardScore(
                leaderboardId,
                LeaderboardVariant.TIME_SPAN_ALL_TIME,
                LeaderboardVariant.COLLECTION_PUBLIC
            )
            .addOnSuccessListener(annotated -> {
                LeaderboardScore score = annotated.get();
                JSObject ret = new JSObject();
                if (score == null) {
                    ret.put("hasScore", false);
                } else {
                    ret.put("hasScore", true);
                    ret.put("rank", score.getRank());
                    ret.put("displayRank", score.getDisplayRank());
                    ret.put("displayScore", score.getDisplayScore());
                    ret.put("rawScore", score.getRawScore());
                }
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("Failed to load leaderboard score", e));
    }

    @PluginMethod
    public void showLeaderboard(PluginCall call) {
        String leaderboardId = call.getString("leaderboardId");
        LeaderboardsClient client = PlayGames.getLeaderboardsClient(getActivity());
        (leaderboardId == null ? client.getAllLeaderboardsIntent() : client.getLeaderboardIntent(leaderboardId))
            .addOnSuccessListener(intent -> startActivityForResult(call, intent, "leaderboardResult"))
            .addOnFailureListener(e -> call.reject("Failed to open leaderboard", e));
    }

    @ActivityCallback
    private void leaderboardResult(PluginCall call, ActivityResult result) {
        if (call != null) {
            call.resolve();
        }
    }
}
