"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";

const PLAYER_TAB_ROOTS = new Set(["/home", "/comunidad", "/perfil", "/clubes", "/inicio"]);

function closePlayerDrawer() {
  window.dispatchEvent(new CustomEvent("player-drawer-toggle", { detail: { open: false } }));
}

export default function CapacitorNativeBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let removeListener: (() => void) | undefined;

    void App.addListener("backButton", ({ canGoBack }) => {
      if (document.body.classList.contains("player-drawer-open")) {
        closePlayerDrawer();
        return;
      }

      if (canGoBack) {
        router.back();
        return;
      }

      const path = pathname ?? "/";
      if (!PLAYER_TAB_ROOTS.has(path)) {
        router.push("/home");
        return;
      }

      void App.exitApp();
    }).then((listener) => {
      removeListener = () => listener.remove();
    });

    return () => removeListener?.();
  }, [pathname, router]);

  return null;
}
