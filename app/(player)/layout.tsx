import type { ReactNode } from "react";
import BottomNav from "@/components/bottom-nav";
import CapacitorNativeBackButton from "@/components/capacitor-native-back-button";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import PlayerNavigationProgress from "@/components/player-navigation-progress";
import PlayerRoutePrefetch from "@/components/player-route-prefetch";
import TopNav from "@/components/top-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="player-app-shell min-h-dvh w-full max-w-full bg-transparent">
      <CapacitorShellReady />
      <PlayerRoutePrefetch />
      <CapacitorNativeBackButton />
      <TopNav />
      <PlayerNavigationProgress />
      <div className="w-full max-w-full pt-[var(--player-top-chrome-offset)]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
