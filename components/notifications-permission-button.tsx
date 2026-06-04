"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/utils/supabase/client";

export default function NotificationsPermissionButton() {
  const [status, setStatus] = useState<"unknown" | "granted" | "denied" | "requesting">("unknown");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    async function checkStatus() {
      try {
        const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
        const perm = await OneSignal.Notifications.getPermissionAsync();
        setStatus(perm ? "granted" : "denied");
      } catch {
        setStatus("denied");
      }
    }
    checkStatus();
  }, []);

  if (!Capacitor.isNativePlatform()) return null;
  if (status === "unknown" || status === "granted") return null;

  async function handleRequest() {
    try {
      setStatus("requesting");
      const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
      await OneSignal.initialize({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "",
      });
      const granted = await OneSignal.Notifications.requestPermission(true);
      if (granted) {
        setStatus("granted");
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
      } else {
        setStatus("denied");
      }
    } catch {
      setStatus("denied");
    }
  }

  return (
    <button
      onClick={handleRequest}
      disabled={status === "requesting"}
      className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition active:scale-95"
    >
      {status === "requesting" ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0585FC] border-t-transparent" />
      ) : (
        <Bell size={14} className="text-[#0585FC]" />
      )}
      {status === "requesting" ? "Activando..." : "Activar notificaciones"}
    </button>
  );
}
