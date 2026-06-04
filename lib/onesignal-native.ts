"use client";

import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

function getAppId() {
  return process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ?? "";
}

export async function getOneSignalPlugin() {
  const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
  return OneSignal;
}

export async function ensureOneSignalInitialized() {
  const appId = getAppId();
  if (!appId) {
    console.error("[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID no está configurado");
    return null;
  }
  const OneSignal = await getOneSignalPlugin();
  await OneSignal.initialize(appId);
  return OneSignal;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const OneSignal = await ensureOneSignalInitialized();
  if (!OneSignal) return false;
  return OneSignal.Notifications.hasPermission();
}

/** Registra external_id y guarda el token en profiles. Devuelve false si falló. */
export async function registerOneSignalUser(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const OneSignal = await ensureOneSignalInitialized();
    if (!OneSignal) return false;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    await OneSignal.login(user.id);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const token = await OneSignal.User.pushSubscription.getTokenAsync();
    if (!token) {
      console.warn("[OneSignal] Sin token de push aún");
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ onesignal_player_id: token })
      .eq("user_id", user.id);

    if (error) {
      console.error("[OneSignal] Error guardando token:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[OneSignal] registerOneSignalUser:", err);
    return false;
  }
}
