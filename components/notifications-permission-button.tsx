"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  hasNotificationPermission,
  requestPushPermissionAndRegister,
} from "@/lib/onesignal-native";

export default function NotificationsPermissionButton() {
  const [status, setStatus] = useState<"loading" | "granted" | "denied" | "requesting">("loading");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    async function checkStatus() {
      try {
        const perm = await hasNotificationPermission();
        if (perm) {
          await requestPushPermissionAndRegister();
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
      const ok = await requestPushPermissionAndRegister();
      setStatus(ok ? "granted" : "denied");
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
