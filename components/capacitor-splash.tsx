"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

export default function CapacitorSplashHide() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const timer = window.setTimeout(() => {
      void SplashScreen.hide().catch(() => {
        // Splash may already be hidden on some platforms.
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
