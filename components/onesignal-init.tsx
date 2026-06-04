"use client";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

export default function OneSignalInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function init() {
      try {
        // Esperar a que el DOM y Capacitor estén listos
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const { default: OneSignal } = await import("@onesignal/capacitor-plugin");

        await OneSignal.initialize({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "",
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        const granted = await OneSignal.Notifications.requestPermission(true);
        console.log("OneSignal permission granted:", granted);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await OneSignal.login({ externalId: user.id });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const token = await OneSignal.User.pushSubscription.getToken();
        if (!token) return;

        await supabase
          .from("profiles")
          .update({ onesignal_player_id: token })
          .eq("user_id", user.id);

      } catch (err) {
        console.error("OneSignal init error:", err);
      }
    }

    // Escuchar el evento de que el shell está listo
    window.addEventListener("capacitor-shell-ready", () => init(), { once: true });
    // Fallback: si el evento ya pasó, correr igual después de 3 segundos
    setTimeout(() => init(), 3000);

  }, []);

  return null;
}
