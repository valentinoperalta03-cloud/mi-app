"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  ensureOneSignalInitialized,
  hasNotificationPermission,
  registerOneSignalUser,
} from "@/lib/onesignal-native";

export default function NotificationsPermissionButton() {
  const [status, setStatus] = useState<"loading" | "granted" | "denied" | "requesting">("loading");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    async function checkStatus() {
      try {
        const OneSignal = await ensureOneSignalInitialized();
        if (!OneSignal) {
          setStatus("denied");
          return;
        }
        const perm = await hasNotificationPermission();
        if (perm) {
          await registerOneSignalUser();
          setStatus("granted");
        } else {
          setStatus("denied");
        }
      } catch {
        setStatus("denied");
      }
    }
    void checkStatus();
  }, []);

  if (!Capacitor.isNativePlatform()) return null;
  if (status === "loading" || status === "granted") return null;

  async function handleRequest() {
    try {
      setStatus("requesting");
      const OneSignal = await ensureOneSignalInitialized();
      if (!OneSignal) {
        setStatus("denied");
        return;
      }
      const granted = await OneSignal.Notifications.requestPermission(true);
      if (granted) {
        await registerOneSignalUser();
        setStatus("granted");
      } else {
        setStatus("denied");
      }
    } catch {
      setStatus("denied");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleRequest()}
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
