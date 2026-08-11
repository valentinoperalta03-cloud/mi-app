"use client";

import { LayoutGroup } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivacionPath, isFacturacionPath } from "@/lib/auth-redirect";
import { AdminSidebarProvider, useAdminSidebar } from "./admin-sidebar-context";

/**
 * Un solo LayoutGroup para layoutId del contenido, el pill del sidebar y la
 * barra inferior. /admin/activacion vive bajo app/admin/(standalone)/ pero
 * los route groups no evitan heredar app/admin/layout.tsx (los layouts se
 * anidan por arbol de carpetas, no por route groups) — por eso el corte real
 * de sidebar/nav pasa aca, chequeando el pathname en runtime en vez de la
 * estructura de archivos.
 */
function AdminShellContent({
  children,
  chrome,
  trialBanner,
}: {
  children: ReactNode;
  chrome: ReactNode;
  trialBanner: ReactNode;
}) {
  const pathname = usePathname();
  const { collapsed } = useAdminSidebar();

  // /admin/facturacion tampoco muestra sidebar (AdminSidebar ya se auto-oculta
  // ahi via isFacturacionPath) — el contenido no debe dejarle el hueco del
  // margin-left si no hay nada ocupando ese espacio.
  const showSidebarMargin = !isFacturacionPath(pathname);

  return (
    <LayoutGroup id="admin-app-chrome">
      {chrome}
      <div
        className={`admin-shell-bg min-h-dvh px-4 pb-8 pt-[var(--admin-top-chrome-offset)] transition-[margin-left] duration-300 ease-in-out md:px-8 md:pb-8 md:pt-0 ${
          showSidebarMargin ? "ml-0 md:ml-[var(--admin-current-sidebar-w)]" : "ml-0"
        }`}
        style={
          showSidebarMargin
            ? ({
                "--admin-current-sidebar-w": collapsed
                  ? "var(--admin-sidebar-collapsed-width)"
                  : "var(--admin-sidebar-width)",
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="w-full">
          {trialBanner}
          {children}
        </div>
      </div>
    </LayoutGroup>
  );
}

export default function AdminShellBody({
  children,
  chrome,
  trialBanner,
}: {
  children: ReactNode;
  chrome: ReactNode;
  trialBanner: ReactNode;
}) {
  const pathname = usePathname();

  if (isActivacionPath(pathname)) {
    return <LayoutGroup id="admin-app-chrome">{children}</LayoutGroup>;
  }

  return (
    <AdminSidebarProvider>
      <AdminShellContent chrome={chrome} trialBanner={trialBanner}>
        {children}
      </AdminShellContent>
    </AdminSidebarProvider>
  );
}
