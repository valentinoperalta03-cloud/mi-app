import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import BottomNav from "@/components/bottom-nav";
import TopNav from "@/components/top-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <TopNav />
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">{children}</div>
      <BottomNav />
    </div>
  );
}
