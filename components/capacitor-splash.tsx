"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

const SPLASH_MAX_MS = 4000;

function hideSplash() {
  void SplashScreen.hide().catch(() => {
    // Splash may already be hidden on some platforms.
  });
}

function prefetchHomeData() {
  void fetch("/api/prefetch", {
    credentials: "include",
    cache: "no-store",
  }).catch(() => {
    // Prefetch is best-effort; home still loads normally on miss.
  });
}

export default function CapacitorSplashHide() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    prefetchHomeData();

    let hidden = false;
    const hideOnce = () => {
      if (hidden) return;
      hidden = true;
      hideSplash();
    };

    const hideOnReady = () => hideOnce();
    const hardMax = window.setTimeout(hideOnce, SPLASH_MAX_MS);

    if (document.readyState === "complete") {
      window.setTimeout(hideOnReady, 300);
    } else {
      window.addEventListener("load", hideOnReady, { once: true });
    }

    return () => {
      window.clearTimeout(hardMax);
      window.removeEventListener("load", hideOnReady);
    };
  }, []);

  return null;
}
