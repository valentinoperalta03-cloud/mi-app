import type { ReactNode } from "react";
import BottomNav from "@/components/bottom-nav";
import CapacitorNativeBackButton from "@/components/capacitor-native-back-button";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import TopNav from "@/components/top-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="player-app-shell min-h-dvh w-full max-w-full bg-transparent">
      <CapacitorShellReady />
      <CapacitorNativeBackButton />
      <TopNav />
      <div className="w-full max-w-full pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
