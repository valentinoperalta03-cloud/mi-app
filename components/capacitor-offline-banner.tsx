"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network, type ConnectionStatus } from "@capacitor/network";

function isOfflineStatus(status: ConnectionStatus): boolean {
  return !status.connected;
}

export default function CapacitorOfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    void (async () => {
      try {
        const status = await Network.getStatus();
        setOffline(isOfflineStatus(status));
      } catch {
        // Plugin no disponible
      }

      const listener = await Network.addListener("networkStatusChange", (status) => {
        setOffline(isOfflineStatus(status));
      });
      removeListener = () => listener.remove();
    })();

    return () => removeListener?.();
  }, []);

  if (!Capacitor.isNativePlatform() || !offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex h-0 justify-center overflow-visible px-4"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.75rem)" }}
    >
      <p className="rounded-full bg-slate-900/90 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
        Sin conexión — algunos datos pueden no actualizarse
      </p>
    </div>
  );
}
