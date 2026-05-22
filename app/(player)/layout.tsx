import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import BottomNav from "@/components/bottom-nav";
import TopNav from "@/components/top-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="player-app-shell min-h-dvh w-full max-w-full bg-transparent">
      <TopNav />
      <div className="w-full max-w-full pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
