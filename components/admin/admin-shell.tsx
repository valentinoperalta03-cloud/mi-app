import type { ReactNode } from "react";
import AdminDesktopHeaderWrapper from "./admin-desktop-header-wrapper";
import AdminRouteTransition from "./admin-route-transition";
import AdminShellBody from "./admin-shell-body";
import TrialBanner from "./trial-banner";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell-bg min-h-dvh">
      <AdminShellBody header={<AdminDesktopHeaderWrapper />} trialBanner={<TrialBanner />}>
        <AdminRouteTransition>{children}</AdminRouteTransition>
      </AdminShellBody>
    </div>
  );
}
