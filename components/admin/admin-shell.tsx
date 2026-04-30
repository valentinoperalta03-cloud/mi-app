import type { ReactNode } from "react";
import AdminBottomNav from "./admin-bottom-nav";
import AdminDesktopHeader from "./admin-desktop-header";
import AdminRouteTransition from "./admin-route-transition";
import AdminShellBody from "./admin-shell-body";
import ThemeToggleButton from "@/components/theme-toggle-button";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)]">
      <AdminShellBody>
        <AdminDesktopHeader />
        <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-3 md:hidden">
          <div className="w-full max-w-xs">
            <ThemeToggleButton />
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 md:pb-10 md:pt-8">
          <AdminRouteTransition>{children}</AdminRouteTransition>
        </div>
        <AdminBottomNav />
      </AdminShellBody>
    </div>
  );
}
