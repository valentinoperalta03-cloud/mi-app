import type { ReactNode } from "react";
import AdminBottomNav from "./admin-bottom-nav";
import AdminDesktopHeader from "./admin-desktop-header";
import AdminRouteTransition from "./admin-route-transition";
import AdminShellBody from "./admin-shell-body";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)]">
      <AdminShellBody>
        <AdminDesktopHeader />
        <div className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 md:px-8 md:pb-10 md:pt-8">
          <AdminRouteTransition>{children}</AdminRouteTransition>
        </div>
        <AdminBottomNav />
      </AdminShellBody>
    </div>
  );
}
