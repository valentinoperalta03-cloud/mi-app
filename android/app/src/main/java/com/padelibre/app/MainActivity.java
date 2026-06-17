package com.padelibre.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        disableWebViewOverscroll();
        configureEdgeToEdge();
    }

    /**
     * Re-applies edge-to-edge when the app regains focus (e.g. after task
     * switching). On Samsung One UI, returning from another app can leave
     * system bars in an unexpected state that breaks the touch mapping.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            configureEdgeToEdge();
        }
    }

    private void disableWebViewOverscroll() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        }
    }

    /**
     * Configures true edge-to-edge display: content renders behind the status
     * bar and navigation bar, both of which become transparent overlays.
     *
     * WHY WE DO NOT HIDE THE NAVIGATION BAR:
     * Hiding it (via WindowInsetsController.hide() or SYSTEM_UI_FLAG_HIDE_NAVIGATION)
     * causes a well-documented Android WebView bug. The WebView expands to fill
     * the freed space, but when the navigation bar transiently re-appears on
     * swipe (Samsung gesture navigation), the WebView does NOT recalculate its
     * touch coordinate mapping. Every tap then registers ~48 px offset from
     * the actual touch point, making the lower portion of the screen completely
     * unresponsive — the exact symptom reported on Samsung devices.
     *
     * The correct solution is to keep the bar present but transparent, and let
     * CSS env(safe-area-inset-bottom) handle content padding.
     */
    private void configureEdgeToEdge() {
        Window window = getWindow();
        if (window == null) return;

        // Required for setNavigationBarColor to take effect regardless of theme.
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // Transparent navigation bar — content renders behind it.
        window.setNavigationBarColor(Color.TRANSPARENT);

        // API 29+: prevent Android from adding an automatic contrast scrim
        // behind the transparent navigation bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        // Allow content to extend into display cutout areas (notch / punch-hole)
        // common on Samsung Galaxy A and S series.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // API 30+ (Android 11+): modern WindowInsets API.
            // setDecorFitsSystemWindows(false) is the official way to opt into
            // edge-to-edge; also mandatory on Android 15+ (targetSdk 35+).
            window.setDecorFitsSystemWindows(false);

            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                // Allows the navigation bar to appear transiently on swipe
                // without permanently restoring it. Does NOT hide the bar,
                // so no coordinate offset occurs.
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        // API 24–29: legacy SystemUiVisibility flags.
        // LAYOUT_HIDE_NAVIGATION = "extend layout *behind* the nav bar"
        // NOT the same as HIDE_NAVIGATION = "hide the nav bar" (which causes the bug).
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }
}
