import type { ReactNode } from "react";
import AdminBottomNav from "./admin-bottom-nav";
import AdminDesktopHeaderWrapper from "./admin-desktop-header-wrapper";
import AdminRouteTransition from "./admin-route-transition";
import AdminShellBody from "./admin-shell-body";
import TrialBanner from "./trial-banner";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)]">
      <AdminShellBody>
        <AdminDesktopHeaderWrapper />
        <div className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 md:pb-10 md:pt-8">
          <TrialBanner />
          <AdminRouteTransition>{children}</AdminRouteTransition>
        </div>
        <AdminBottomNav />
      </AdminShellBody>
    </div>
  );
}
