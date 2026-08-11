import type { ReactNode } from "react";
import AdminRouteTransition from "./admin-route-transition";
import AdminShellBody from "./admin-shell-body";
import AdminSidebarWrapper from "./admin-sidebar-wrapper";
import TrialBanner from "./trial-banner";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell-bg min-h-dvh">
      <AdminShellBody chrome={<AdminSidebarWrapper />} trialBanner={<TrialBanner />}>
        <AdminRouteTransition>{children}</AdminRouteTransition>
      </AdminShellBody>
    </div>
  );
}
