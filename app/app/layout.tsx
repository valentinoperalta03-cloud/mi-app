import type { ReactNode } from "react";
import BottomNav from "@/components/bottom-nav";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      {children}
      <BottomNav />
    </div>
  );
}
