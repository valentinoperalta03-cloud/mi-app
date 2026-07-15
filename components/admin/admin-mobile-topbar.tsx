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
      <header className="admin-top-chrome fixed inset-x-0 top-0 z-40 bg-brand-gradient md:hidden">
        <div className="flex h-[52px] items-center justify-between px-4">
          <Link href="/admin/dashboard" aria-label="Ir al inicio" className="shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
              <img
                src={logoUrl}
                alt="Logo del club"
                className="h-9 w-9 rounded-full border-2 border-[var(--admin-accent-lima)] object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full border-2 border-[var(--admin-accent-lima)] bg-[#0585FC]" />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-white/10 active:scale-95"
          >
            <Menu size={22} aria-hidden />
          </button>
        </div>
      </header>
      <AdminMobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
