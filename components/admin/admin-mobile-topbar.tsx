"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { isFacturacionPath } from "@/lib/auth-redirect";
import AdminMobileMenu from "./admin-mobile-menu";

export default function AdminMobileTopBar({ logoUrl }: { logoUrl: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (isFacturacionPath(pathname)) return null;

  return (
    <>
      <header
        className="admin-top-chrome fixed inset-x-0 top-0 z-40 md:hidden"
        style={{ background: "var(--admin-header-bg)", borderBottom: "2px solid var(--admin-header-lima-line)" }}
      >
        <div className="flex h-[52px] items-center justify-between px-4">
          <Link href="/admin/dashboard" aria-label="Ir al inicio" className="shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
              <img
                src={logoUrl}
                alt="Logo del club"
                className="h-9 w-9 rounded-full border-2 object-cover"
                style={{ borderColor: "var(--admin-header-logo-border)" }}
              />
            ) : (
              <div
                className="h-9 w-9 rounded-full border-2 bg-[#0085FC]"
                style={{ borderColor: "var(--admin-header-logo-border)" }}
              />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-[#0085FC]/10 active:scale-95"
            style={{ color: "var(--admin-header-text)" }}
          >
            <Menu size={22} aria-hidden />
          </button>
        </div>
      </header>
      <AdminMobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
