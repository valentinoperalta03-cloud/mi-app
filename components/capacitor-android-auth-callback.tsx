"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  completeAndroidGoogleOAuthFromDeepLink,
  parseNativeOAuthCallback,
} from "@/lib/android-google-oauth";

export default function CapacitorAndroidAuthCallback() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let removeListener: (() => void) | undefined;

    void App.addListener("appUrlOpen", async (event) => {
      if (!parseNativeOAuthCallback(event.url)) {
        return;
      }

      try {
        await Browser.close();
      } catch {
        // Custom Tab ya cerrado o no abierto
      }

      const result = await completeAndroidGoogleOAuthFromDeepLink(event.url);
      window.location.href = result.redirectTo;
    }).then((listener) => {
      removeListener = () => listener.remove();
    });

    return () => removeListener?.();
  }, []);

  return null;
}
