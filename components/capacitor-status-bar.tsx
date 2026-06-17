"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isCapacitorIosIpad } from "@/lib/capacitor-device";
import { applyNativeSafeAreaCssVars } from "@/lib/native-safe-area";
import { STATUS_BAR_COLOR } from "@/lib/status-bar-color";

export default function CapacitorStatusBarInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    root.classList.add("capacitor-native");
    if (Capacitor.getPlatform() === "ios" && isCapacitorIosIpad()) {
      root.classList.add("capacitor-ipad");
    }

    void (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Measure AFTER overlay is applied so env(safe-area-inset-top)
        // returns the actual status bar height (not 0).
        applyNativeSafeAreaCssVars(root);
        await StatusBar.setStyle({ style: Style.Light });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR });
        }
        await StatusBar.show();
      } catch {
        // Plugin unavailable in preview; header CSS covers safe area on iOS.
        applyNativeSafeAreaCssVars(root);
      } finally {
        applyNativeSafeAreaCssVars(root);
      }
    })();

    const onOrientationChange = () => applyNativeSafeAreaCssVars(root);
    window.addEventListener("orientationchange", onOrientationChange);
    return () => window.removeEventListener("orientationchange", onOrientationChange);
  }, []);

  return null;
}
