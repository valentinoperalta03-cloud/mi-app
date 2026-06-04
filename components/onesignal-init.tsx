"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

export default function OneSignalInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Registrar al usuario en OneSignal via REST API usando su user_id como external_id
        await fetch("https://api.onesignal.com/apps/" + process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID + "/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identity: {
              external_id: user.id,
            },
            subscriptions: [
              {
                type: Capacitor.getPlatform() === "ios" ? "iOSPush" : "AndroidPush",
              }
            ]
          }),
        });

      } catch (err) {
        console.error("OneSignal init error:", err);
      }
    }

    init();
  }, []);

  return null;
}
