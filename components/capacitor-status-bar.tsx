"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const STATUS_BAR_COLOR = "#1A6BC4";

export default function CapacitorStatusBarInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("capacitor-native");
    document.documentElement.style.setProperty("--status-bar-height", "env(safe-area-inset-top)");

    void (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR });
        await StatusBar.show();
      } catch {
        // Plugin may be unavailable during web preview; native shell still uses Info.plist.
      }
    })();
  }, []);

  return null;
}
