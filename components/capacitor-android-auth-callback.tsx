"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  completeAndroidGoogleOAuthFromDeepLink,
  parseNativeOAuthCallback,
} from "@/lib/android-google-oauth";

function redirectToLoginError(message: string) {
  const params = new URLSearchParams({
    kind: "error",
    message,
  });
  window.location.href = `/login?${params.toString()}`;
}

export default function CapacitorAndroidAuthCallback() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let removeListener: (() => void) | undefined;

    void App.addListener("appUrlOpen", async (event) => {
      try {
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
      } catch (err) {
        console.error("[CapacitorAndroidAuthCallback] OAuth callback failed", err);
        const message =
          err instanceof Error ? err.message : "No se pudo completar el inicio de sesión.";
        redirectToLoginError(message);
      }
    })
      .then((listener) => {
        removeListener = () => listener.remove();
      })
      .catch((err) => {
        console.error("[CapacitorAndroidAuthCallback] failed to register appUrlOpen listener", err);
      });

    return () => removeListener?.();
  }, []);

  return null;
}
