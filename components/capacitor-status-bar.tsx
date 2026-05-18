"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { STATUS_BAR_COLOR } from "@/lib/status-bar-color";

export default function CapacitorStatusBarInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("capacitor-native");
    document.documentElement.style.setProperty("--status-bar-height", "env(safe-area-inset-top, 0px)");

    void (async () => {
      try {
        // iOS ignores setBackgroundColor; overlay + CSS safe-area paints the blue chrome.
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR });
        }
        await StatusBar.show();
      } catch {
        // Plugin may be unavailable during web preview; native shell still uses Info.plist.
      }
    })();
  }, []);

  return null;
}
