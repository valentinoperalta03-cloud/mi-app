"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { prefetchPlayerHomeData } from "@/lib/player-route-prefetch";

const SPLASH_MAX_MS = 4000;

function hideSplash() {
  void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
}

export default function CapacitorSplashHide() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    prefetchPlayerHomeData();

    let hidden = false;
    const hideOnce = () => {
      if (hidden) return;
      hidden = true;
      hideSplash();
    };

    const hardMax = window.setTimeout(hideOnce, SPLASH_MAX_MS);

    const onShellReady = () => {
      window.requestAnimationFrame(() => hideOnce());
    };

    window.addEventListener("capacitor-shell-ready", onShellReady, { once: true });

    if (document.readyState === "complete") {
      window.setTimeout(() => {
        if (!hidden) hideOnce();
      }, 600);
    } else {
      window.addEventListener(
        "load",
        () => {
          window.setTimeout(() => {
            if (!hidden) hideOnce();
          }, 600);
        },
        { once: true }
      );
    }

    return () => {
      window.clearTimeout(hardMax);
      window.removeEventListener("capacitor-shell-ready", onShellReady);
    };
  }, []);

  return null;
}
