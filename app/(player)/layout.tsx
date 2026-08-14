"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import CapacitorNativeBackButton from "@/components/capacitor-native-back-button";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import OneSignalInit from "@/components/onesignal-init";
import PlayerNavigationProgress from "@/components/player-navigation-progress";
import PlayerRoutePrefetch from "@/components/player-route-prefetch";
import TopNav from "@/components/top-nav";

/** Rutas de pantalla completa: sin TopNav ni BottomNav. */
const FULLSCREEN_ROUTES: string[] = [];

export default function PlayerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className="player-app-shell min-h-dvh w-full max-w-full bg-transparent">
      <CapacitorShellReady />
      <OneSignalInit />
      <PlayerRoutePrefetch />
      <CapacitorNativeBackButton />
      {!isFullscreen && <TopNav />}
      <PlayerNavigationProgress />
      <div className={`w-full max-w-full ${isFullscreen ? "" : "pt-[var(--player-top-chrome-offset)]"}`}>
        {children}
      </div>
      {!isFullscreen && <BottomNav />}
    </div>
  );
}
