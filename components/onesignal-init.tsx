"use client";

import { useEffect } from "react";
import OneSignal from "@onesignal/capacitor-plugin";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

export default function OneSignalInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function init() {
      try {
        await OneSignal.initialize({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "",
        });

        await OneSignal.Notifications.requestPermission(true);

        const { pushSubscription } = OneSignal.User;
        const token = await pushSubscription.getToken();
        if (!token) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await OneSignal.login({ externalId: user.id });

        await supabase
          .from("profiles")
          .update({ onesignal_player_id: token })
          .eq("user_id", user.id);

      } catch (err) {
        console.error("OneSignal init error:", err);
      }
    }

    init();
  }, []);

  return null;
}
