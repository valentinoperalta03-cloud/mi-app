"use client";

import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

const PUSH_PROMPT_KEY = "padelibre_onesignal_prompted_v1";

function getAppId() {
  return process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ?? "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForPushToken(
  OneSignal: Awaited<ReturnType<typeof ensureOneSignalInitialized>>,
  attempts = 6,
  delayMs = 800
): Promise<string | null> {
  if (!OneSignal) return null;
  for (let i = 0; i < attempts; i++) {
    const token = await OneSignal.User.pushSubscription.getTokenAsync();
    if (token) return token;
    await sleep(delayMs);
  }
  return null;
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

    const permitted = await OneSignal.Notifications.hasPermission();
    if (permitted) {
      await OneSignal.User.pushSubscription.optIn();
    }

    const token = await waitForPushToken(OneSignal);
    if (!token) {
      console.warn("[OneSignal] Sin token de push aún (revisá Audience en el dashboard)");
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

/** Pide permiso del sistema (si aplica) y registra el dispositivo en OneSignal. */
export async function requestPushPermissionAndRegister(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const OneSignal = await ensureOneSignalInitialized();
    if (!OneSignal) return false;

    const already = await OneSignal.Notifications.hasPermission();
    if (!already) {
      const granted = await OneSignal.Notifications.requestPermission(true);
      if (!granted) return false;
    }

    return registerOneSignalUser();
  } catch (err) {
    console.error("[OneSignal] requestPushPermissionAndRegister:", err);
    return false;
  }
}

/**
 * Una vez por instalación: si aún no hay permiso, muestra el diálogo de iOS al abrir la app.
 * Si el usuario ya denegó, no insiste (sigue el botón en Notificaciones).
 */
export async function maybePromptPushOnAppOpen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(PUSH_PROMPT_KEY) === "1") return;

  const OneSignal = await ensureOneSignalInitialized();
  if (!OneSignal) return;

  if (await OneSignal.Notifications.hasPermission()) {
    window.localStorage.setItem(PUSH_PROMPT_KEY, "1");
    await registerOneSignalUser();
    return;
  }

  const canAsk = await OneSignal.Notifications.canRequestPermission();
  if (!canAsk) return;

  window.localStorage.setItem(PUSH_PROMPT_KEY, "1");
  await requestPushPermissionAndRegister();
}
