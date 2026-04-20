import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import BottomNav from "@/components/bottom-nav";
import TopNav from "@/components/top-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <TopNav />
      <div className="pt-14">{children}</div>
      <BottomNav />
    </div>
  );
}
