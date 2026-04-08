import type { ReactNode } from "react";
import BottomNav from "@/components/bottom-nav";

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
      <BottomNav />
    </div>
  );
}
