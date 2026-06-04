"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import {
  attachOneSignalListeners,
  hasNotificationPermission,
  maybePromptPushOnAppOpen,
  registerOneSignalUser,
} from "@/lib/onesignal-native";

export default function OneSignalInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const detach = attachOneSignalListeners();

    async function init() {
      const granted = await hasNotificationPermission();
      if (granted) {
        await registerOneSignalUser();
        return;
      }
      await maybePromptPushOnAppOpen();
    }

    const onReady = () => void init();
    window.addEventListener("capacitor-shell-ready", onReady, { once: true });
    const fallback = window.setTimeout(() => void init(), 5000);

    return () => {
      window.removeEventListener("capacitor-shell-ready", onReady);
      window.clearTimeout(fallback);
      detach();
    };
  }, []);

  return null;
}
