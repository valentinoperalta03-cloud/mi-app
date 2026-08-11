"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "admin-sidebar-collapsed";

type AdminSidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
};

const AdminSidebarContext = createContext<AdminSidebarContextValue | null>(null);

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  // Lee la preferencia guardada recién en el cliente — evita mismatch de
  // hidratación (el server siempre renderiza "expandido" por default).
  useEffect(() => {
    try {
      setCollapsedState(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage no disponible (SSR/incógnito estricto) — sigue expandido.
    }
  }, []);

  function setCollapsed(value: boolean) {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // noop
    }
  }

  return (
    <AdminSidebarContext.Provider value={{ collapsed, setCollapsed }}>{children}</AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar(): AdminSidebarContextValue {
  const ctx = useContext(AdminSidebarContext);
  if (!ctx) throw new Error("useAdminSidebar debe usarse dentro de AdminSidebarProvider");
  return ctx;
}
