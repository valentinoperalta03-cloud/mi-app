"use client";

import { LayoutGroup } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivacionPath } from "@/lib/auth-redirect";

/**
 * Un solo LayoutGroup para layoutId del contenido y de la barra inferior.
 * /admin/activacion vive bajo app/admin/(standalone)/ pero los route groups
 * no evitan heredar app/admin/layout.tsx (los layouts se anidan por arbol de
 * carpetas, no por route groups) — por eso el corte real de header/nav pasa
 * aca, chequeando el pathname en runtime en vez de la estructura de archivos.
 */
export default function AdminShellBody({
  children,
  header,
  trialBanner,
}: {
  children: ReactNode;
  header: ReactNode;
  trialBanner: ReactNode;
}) {
  const pathname = usePathname();

  if (isActivacionPath(pathname)) {
    return <LayoutGroup id="admin-app-chrome">{children}</LayoutGroup>;
  }

  return (
    <LayoutGroup id="admin-app-chrome">
      {header}
      <div className="admin-shell-bg min-h-dvh px-4 pb-8 pt-[var(--admin-top-chrome-offset)] sm:px-6 lg:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-7xl">
          {trialBanner}
          {children}
        </div>
      </div>
    </LayoutGroup>
  );
}
