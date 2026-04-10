import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, House, Settings2, Trophy, UserRound } from "lucide-react";
import AdminBottomNav from "./admin-bottom-nav";

const desktopLinks = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/club/gestion", label: "Turnos", icon: CalendarClock },
  { href: "/club/partidos", label: "Partidos", icon: Trophy },
  { href: "/club/horarios", label: "Canchas", icon: Settings2 },
  { href: "/perfil", label: "Perfil", icon: UserRound },
] as const;

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-white to-slate-50/80">
      <header className="sticky top-0 z-40 hidden border-b border-slate-100/80 bg-white/85 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold tracking-tight text-slate-900">Panel del club</p>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Secciones">
            {desktopLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-sky-600"
                >
                  <Icon size={16} strokeWidth={2} className="text-slate-400" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:pb-10 md:pt-8">{children}</div>

      <AdminBottomNav />
    </div>
  );
}
