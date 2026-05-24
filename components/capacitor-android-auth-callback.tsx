"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getAuthSiteOrigin, NATIVE_AUTH_CALLBACK_URL } from "@/lib/auth-site-url";

const NATIVE_CALLBACK_PREFIX = NATIVE_AUTH_CALLBACK_URL.split("?")[0];

function nativeAuthUrlToWebCallback(url: string): string | null {
  if (url.startsWith(NATIVE_CALLBACK_PREFIX)) {
    const queryStart = url.indexOf("?");
    const search = queryStart >= 0 ? url.slice(queryStart) : "";
    return `${getAuthSiteOrigin()}/auth/callback${search}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/callback") {
      return url;
    }
  } catch {
    return null;
  }

  return null;
}

export default function CapacitorAndroidAuthCallback() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let removeListener: (() => void) | undefined;

    void App.addListener("appUrlOpen", async (event) => {
      const webUrl = nativeAuthUrlToWebCallback(event.url);
      if (!webUrl) return;

      try {
        await Browser.close();
      } catch {
        // Custom Tab ya cerrado o no abierto
      }

      window.location.href = webUrl;
    }).then((listener) => {
      removeListener = () => listener.remove();
    });

    return () => removeListener?.();
  }, []);

  return null;
}
