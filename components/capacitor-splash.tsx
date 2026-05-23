"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

function hideSplash() {
  void SplashScreen.hide().catch(() => {
    // Splash may already be hidden on some platforms.
  });
}

export default function CapacitorSplashHide() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const hideOnReady = () => hideSplash();
    const failSafe = window.setTimeout(hideSplash, 8000);

    if (document.readyState === "complete") {
      window.setTimeout(hideOnReady, 300);
    } else {
      window.addEventListener("load", hideOnReady, { once: true });
    }

    return () => {
      window.clearTimeout(failSafe);
      window.removeEventListener("load", hideOnReady);
    };
  }, []);

  return null;
}
