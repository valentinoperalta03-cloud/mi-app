"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/superadmin", label: "Dashboard", icon: "🏠" },
  { href: "/superadmin/clubes", label: "Clubes", icon: "🏢" },
  { href: "/superadmin/finanzas", label: "Finanzas", icon: "💰" },
  { href: "/superadmin/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/superadmin/estadisticas", label: "Estadísticas", icon: "📊" },
  { href: "/superadmin/reuniones", label: "Reuniones", icon: "📅" },
] as const;

export default function SuperadminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-white/10 bg-slate-900/95 px-3 py-6 backdrop-blur md:flex md:w-64">
      <div className="px-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/90">PadeLibre</p>
        <p className="mt-1 text-base font-semibold text-white">Superadmin</p>
      </div>
      <nav className="mt-8 flex flex-col gap-1">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/superadmin" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/30" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 pt-4 text-xs text-slate-500">
        <Link href="/home" className="block rounded-lg px-3 py-2 text-slate-400 hover:bg-white/5 hover:text-slate-200">
          ← Volver a la app
        </Link>
      </div>
    </aside>
  );
}
