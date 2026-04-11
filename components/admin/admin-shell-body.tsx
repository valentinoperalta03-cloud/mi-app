"use client";

import { LayoutGroup } from "framer-motion";
import type { ReactNode } from "react";

/** Un solo LayoutGroup para layoutId del contenido y de la barra inferior. */
export default function AdminShellBody({ children }: { children: ReactNode }) {
  return <LayoutGroup id="admin-app-chrome">{children}</LayoutGroup>;
}
