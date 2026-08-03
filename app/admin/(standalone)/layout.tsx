import type { ReactNode } from "react";

/**
 * Route group sin chrome propio. OJO: los layouts de Next.js se anidan segun
 * el arbol de carpetas, no segun los route groups — este layout sigue viviendo
 * DENTRO de app/admin/layout.tsx, asi que por si solo NO alcanza para ocultar
 * el header/nav del panel (eso lo resuelve AdminShell/AdminShellBody leyendo
 * el pathname). Este archivo solo evita agregar chrome propio en el medio.
 */
export default function StandaloneAdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
