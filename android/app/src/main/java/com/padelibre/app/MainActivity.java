package com.padelibre.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        disableWebViewOverscroll();
        configureEdgeToEdge();
    }

    private void disableWebViewOverscroll() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
        }
    }

    /**
     * Makes the navigation bar transparent and extends app content behind it,
     * without hiding the bar (hiding causes a Samsung WebView touch-offset bug).
     *
     * WHY setSystemUiVisibility INSTEAD OF setDecorFitsSystemWindows:
     * Capacitor's StatusBar plugin calls setSystemUiVisibility(LAYOUT_STABLE |
     * LAYOUT_FULLSCREEN) when setOverlaysWebView(true) runs from the React layer.
     * Mixing setDecorFitsSystemWindows(false) with a subsequent setSystemUiVisibility
     * call on the same window produces an inconsistent insets state on Android 11+
     * (Samsung One UI) that corrupts touch-coordinate mapping — the exact symptom
     * where touches only register ~48 px above their visual position.
     *
     * Using setSystemUiVisibility exclusively keeps us on the same API as Capacitor.
     * Capacitor ORs its flags into ours, so LAYOUT_HIDE_NAVIGATION is preserved.
     * LAYOUT_HIDE_NAVIGATION = "extend layout *behind* the bar" (does NOT hide it).
     */
    @SuppressWarnings("deprecation")
    private void configureEdgeToEdge() {
        Window window = getWindow();
        if (window == null) return;

        // Required for setNavigationBarColor to take effect.
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // Transparent navigation bar so app content shows through.
        window.setNavigationBarColor(Color.TRANSPARENT);

        // API 29+: suppress the automatic contrast scrim Android draws behind
        // a transparent navigation bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        // Extend content into display-cutout areas (notch / punch-hole camera)
        // common on Samsung Galaxy A-series and S-series.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Extend layout behind both status bar and navigation bar.
        // Capacitor's StatusBar plugin ORs LAYOUT_STABLE | LAYOUT_FULLSCREEN into
        // these flags later, which preserves our LAYOUT_HIDE_NAVIGATION bit.
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }
}
