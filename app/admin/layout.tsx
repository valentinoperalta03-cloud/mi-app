import type { ReactNode } from "react";
import Link from "next/link";

const adminLinks = [
  { href: "/admin/dashboard", label: "Inicio" },
  { href: "/admin/gestion", label: "Gestion" },
  { href: "/admin/canchas", label: "Canchas" },
  { href: "/admin/ingresos", label: "Ingresos" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Portal Administrador</h1>
            <nav className="flex flex-wrap items-center gap-2">
              {adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-95"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
